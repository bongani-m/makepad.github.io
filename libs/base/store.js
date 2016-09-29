
var ProxyFallback = true

var MakeProxy = function(value, handler) {
	return new Proxy(value, handler)
}

if(ProxyFallback){
	// dont use proxies
	class ProxyObject{
		constructor(object, handler){
			// helper property to quickly access underlying object
			Object.defineProperty(this, '0__unwrap__', {
				configurable:true,
				value:object
			})
			Object.defineProperty(this, '__proxymeta__', {
				get:function(){
					return proxyMeta.get(object)
				}
			})
			Object.defineProperty(this, '__proxyfallback__', {
				value:function(){
					var keys = Object.keys(this)
					for(var i = 0; i < keys.length; i++){
						let key = keys[i]
						if(!this.__lookupSetter__(key)){
							var value = this[key]
							if(typeof value === 'function') continue
							// store it on backing object
							object[key] = value
							Object.defineProperty(this, key, {
								get:function(){
									return handler.get(object, key)
								},
								set:function(value){
									return handler.set(object, key, value)
								}
							})
							// initialize
							this[key] = object[key]
						}
					}
					return proxyMeta.get(object)
				}
			})
			for(let key in object){
				var value = object[key]
				if(typeof value === 'function') continue
				Object.defineProperty(this, key, {
					get:function(){
						return handler.get(object, key)
					},
					set:function(value){
						return handler.set(object, key, value)
					}
				})
			}
		}
	}

	class ProxyArray{
		constructor(array, handler){
			this._array = array
			this._handler = handler
			this._defineProxyProps(array.length)
			Object.defineProperty(this, '__proxymeta__', {
				get:function(){
					return proxyMeta.get(array)
				}
			})
			Object.defineProperty(this, '0__unwrap__', {
				configurable:true,
				value:array
			})
		}

		push(...args){
			var total = this._array.length + args.length
			this._defineProxyProps(total)
			for(let i = this._array.length, j = 0; i < total; i++, j++){
				this[i] = args[j]
			}
		}

		pop(){
			var len = this._array.length
			if(!len) return
			var ret = this[len - 1]
			this[len - 1] = undefined
			this._array.length --
			return ret
		}

		forEach(...args){
			return this._array.forEach(...args)
		}

		map(...args){
			return this._array.map(...args)
		}

		indexOf(thing){
			return this._array.indexOf(thing)
		}

		get length(){
			return this._handler.get(this._array, 'length')
		}

		set length(value){
			var oldLen = this._array.length
			// if shorten
			for(var i = oldLen - 1; i >= value; i--){
				this[i] = undefined
			}
			// assure length
			this._defineProxyProps(value)
			this._handler.set(this._array, 'length', value)
		}

		_defineProxyProps(len){
			var proto = ProxyArray.prototype
			for(let i = len -1; i >=0 ; i--){
				if(proto.__lookupGetter__(i))break
				Object.defineProperty(proto, i, {
					get:function(){
						return this._handler.get(this._array, i)
					},
					set:function(value){
						return this._handler.set(this._array, i, value)
					}
				})
			}
		}
	}

	MakeProxy = function(object, handler) {
		var ret
		if(Array.isArray(object)){
			ret = new ProxyArray(object, handler)
		}
		else{
			ret = new ProxyObject(object, handler)
			if(object instanceof Store){
				var keys = Object.getOwnPropertyNames(Object.getPrototypeOf(object))
				for(let i = 0; i < keys.length; i++){
					var key = keys[i]
					ret[key] = object[key]
				}
			}
			else Object.seal(ret)
		}
		return ret
	}
}

var proxyMeta = new WeakMap()
var storeData = new WeakMap()

//
//
//  Datastore
//
//

function storeProxyMeta(value, store){
	var meta = {
		object:value, 
		proxy:MakeProxy(value, proxyHandler),
		store:store,
		parents:{},
		observers:[]
		//parenting:[]
	}
	proxyMeta.set(value, meta)
	return meta
}

var proxyHandler = {
	set(target, key, value){

		var baseMeta = proxyMeta.get(target)
		var data = storeData.get(baseMeta.store)
		if(data.locked) throw new Error("Cannot set value on a locked store")

		var oldValue = target[key]
		var oldReal = oldValue
		if(!data.allowNewKeys && !Array.isArray(target) && !(key in target) && !baseMeta.isRoot){
			throw new Error('Adding new keys to an object is turned off, please specify it fully when adding it to the store')
		}

		// make map on read and write
		var oldObservers
		if(typeof oldValue === 'object' && oldValue){
			var oldMeta = proxyMeta.get(oldValue)
			if(oldMeta){
				oldObservers = oldMeta.observers
				// remove old parent connection
				var p = oldMeta.parents[key]
				if(!p) throw new Error('inconsistency, parent array'+key)
				var idx = p.indexOf(baseMeta)
				if(idx === -1) throw new Error('inconsistency, no key'+key)
				if(p.length === 1) delete oldMeta.parents[key]
				else p.splice(idx, 1)
				//for(let i = 0, l = oldMeta.parenting.length; i < l; i++){
				//	oldMeta.parenting[i]({type:'remove',$meta:oldMeta})
				//}
				oldValue = oldMeta.proxy
			}
		}

		var newValue = value
		var newReal = value
		if(typeof newValue === 'object' && newValue){
			var newMeta = newValue.__proxymeta__ // the value added was a proxy
			// otherwise 
			if(!newMeta && (Array.isArray(newValue)||newValue.constructor === Object)){
				// wire up parents
				newMeta = proxyMeta.get(newValue) || storeProxyMeta(newValue, baseMeta.store)
			}
			if(newMeta){
				// wire up parent relationship
				var p = newMeta.parents[key]
				if(!p) newMeta.parents[key] = [baseMeta]
				else if(p.indexOf(baseMeta) ===-1) p.push(baseMeta)
				// copy oldObservers
				if(oldObservers && oldObservers.length){
					newMeta.observers.push.apply(newMeta.observers, oldObservers)
				}
				//for(let i = 0, l = newMeta.parenting.length; i < l; i++){
				//	oldMeta.parenting[i]({type:'add',$meta:oldMeta})
				//}

				// replace return value with proxy
				newValue = newMeta.proxy
				newReal = newMeta.object
			}
		}

		data.changes.push({
			object:baseMeta.proxy,value:newValue, key:key,  $value:newReal, $object:target, $meta:baseMeta, old:oldValue, $old:oldReal
		})

		target[key] = newReal
		return true
	},
	get(target, key){

		var baseMeta = proxyMeta.get(target)
		if(key === '__proxymeta__'){
			return baseMeta
		}
		var value = target[key]
		if(typeof value === 'object' && (Array.isArray(value)||value.constructor === Object)){
			var valueMeta = proxyMeta.get(value) || storeProxyMeta(value, baseMeta.store)
			var p = valueMeta.parents[key]
			if(!p) valueMeta.parents[key] = [baseMeta]
			else if(p.indexOf(baseMeta) ===-1) p.push(baseMeta)
			return valueMeta.proxy
		}
		return value
	}
}

class Store extends require('base/class'){
	constructor(){
		throw new Error("Cant new Store, use .create")
	}

	static create(allowNewKeys){
		var store = Object.create(Store.prototype)
		var proxy = MakeProxy(store, proxyHandler)

		var info = storeProxyMeta(store, store)
		info.isRoot = true

		storeData.set(store, {
			changes:[],
			eventMap:new Map(),
			locked:true,
			allowNewKeys:allowNewKeys
		})

		return proxy
	}
	
	wrap(object){
		var base = this.__proxymeta__
		var meta = object.__proxymeta__
		if(meta) return meta.proxy//throw new Error("Object is already wrapped") 
		meta = storeProxyMeta(object, base.store)
		return meta.proxy
	}

	unwrap(object){
		if(!object) return
		var meta = object.__proxymeta__
		if(!meta) return object//throw new Error("Object is not wrapped")
		return meta.object
	}

	observe(object, observer/*, parenting*/){
		var meta = object.__proxymeta__
		if(!meta) throw new Error("Object is not observable. use store.wrap() or add it to the store and reference it from the store")
		meta.observers.push(observer)
		return meta.proxy
	}

	act(name, actor, maxLevel){
		var meta = this.__proxymeta__
		var store = storeData.get(meta.object)
		if(!store.locked){
			throw new Error("Recursive store access not allowed")
		}

		store.locked = false
		var changes = store.changes = []
		try{
			actor(this)
		}
		finally{
			// process changes to this if we are running proxyFallback
			if(this.__proxyfallback__) this.__proxyfallback__()
			store.locked = true
			processChanges(name, changes, store, maxLevel!==undefined?maxLevel:Infinity)
		}
	}
}


class Observation{
	constructor(name, level, changes){
		this.name = name
		this.level = level
		this.changes = changes
	}
	
	anyChanges(level, ...query){
		if(level !== this.level) return
		let ret = []
		let changes = this.changes
		let key = query[query.length - 1]
		for(let i = changes.length-1; i >=0 ; --i){
			var change = changes[i]
			if(change.key !== key) continue
			// lets walk up the parent chain whilst matching query
			var parents = change.$meta.parents
			for(var j = query.length - 2; j>=0 ;--j){
				let q = query[j]
				let nextParents = null
				for(let pkey in parents){
					if(q === null || q.constructor === RegExp && pkey.match(q) || q === pkey){
						nextParents = parents[pkey].parents
						break
					}
				}
				if(!nextParents) break
				parents = nextParents
			}
			if(j>=0){//matched
				return change
			}
		}
	}

	allChanges(level, ...query){
		if(level !== this.level) return
		let ret = []
		let changes = this.changes
		let key = query[query.length - 1]
		for(let i = 0; i < changes.length; ++i){
			let change = changes[i]
			if(change.key !== key) continue
			// lets walk up the parent chain whilst matching query
			let parents = change.$meta.parents
			for(var j = query.length - 2; j>=0 ;j--){
				let q = query[j]
				let nextParents = null
				for(let pkey in parents){
					if(q === null || q.constructor === RegExp && pkey.match(q) || q === pkey){
						nextParents = parents[pkey].parents
						break
					}
				}
				if(!nextParents) break
				parents = nextParents
			}
			if(j>=0){//matched
				ret.push(change)
			}
		}
		return ret
	}
}
// process all changes

function processChanges(name, changes, store, maxLevel){
	var eventMap = store.eventMap
	eventMap.clear()
	// process all changes and fire listening properties
	for(let i = 0, l = changes.length; i < l; i++){
		let change = changes[i]
		
		let meta = proxyMeta.get(change.$value)
		var observers = meta && meta.observers
		if(maxLevel > -1 && observers && observers.length){
			pathBreak.set(change.$value, change)
			for(let j = observers.length - 1; j>=0; j--){
				var observer = observers[j]
				var event = eventMap.get(observer)
				if(event) event.changes.push(change)
				else eventMap.set(observer, new Observation(name, -1, [change]))
			}
		}
		scanParents(name, change.$object, change, 0, eventMap, maxLevel)
	}
	eventMap.forEach((event, observer)=>{
		observer(event)
	})	
}

var pathBreak = new WeakMap()
function scanParents(name, node, change, level, eventMap, maxLevel){
	if(level >= maxLevel || pathBreak.get(node) === change) return
	pathBreak.set(node, change)
		
	var meta = proxyMeta.get(node)
	var observers = meta.observers
	for(let j = observers.length - 1; j>=0; j--){
		var observer = observers[j]
		var event = eventMap.get(observer)
		if(event) event.changes.push(change)
		else eventMap.set(observer,new Observation(name, level, [change]))
	}

	var parents = meta.parents
	for(let key in parents){
		var list = parents[key]
		for(let i = list.length-1; i>=0; i--){
			scanParents(name, list[i].object, change, level +1, eventMap)
		}
	}
}

module.exports = Store
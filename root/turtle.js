module.exports = require('class').extend(function Turtle(proto){

	proto.onConstruct = function(view){
		this.view = view
	}

	proto.begin = function(outer){
		this.outer = outer

		var margin, padding
		if(typeof outer._margin === 'object'){
			margin = this.margin = outer._margin
		}
		else{
			margin = this.margin = this.$margin || (this.$margin = [0,0,0,0])
			margin[0] = margin[1] = margin[2] = margin[3] = outer._margin
		}
		if(typeof outer._padding === 'object'){
			padding = this.padding = outer._padding
		}
		else{
			padding = this.padding = this.$padding || (this.$padding = [0,0,0,0])
			padding[0] = padding[1] = padding[2] = padding[3] = outer._padding
		}

		this.align = outer._align || (this.$align || (this.$align=[0,0]))

		// read the x
		var _x = outer._x, _y = outer._y, _w = outer._w, _h = outer._h

		if(typeof _w === 'string'){
			this.width = outer.width
			this.width = this.evalw(_w) - padding[1] - padding[3]
		}
		else this.width = _w - padding[1] - padding[3]

		if(typeof _h === 'string'){
			this.height = outer.height
			this.height = this.evalh(_h) - padding[0] - padding[2]
		}
		else this.height = _h - padding[0] - padding[2]

		this.ix = typeof _x === 'string'? this.evalx(_x): _x
		this.iy = typeof _y === 'string'? this.evaly(_y): _y
	
		if(isNaN(this.ix)) this.ix = outer.wx
		if(isNaN(this.iy)) this.iy = outer.wy

		this.x1 = this.y1 = Infinity
		this.x2 = this.y2 = -Infinity
		this.mh = 0

		// begin walking
		this.sx = this.wx = this.ix + padding[3] + margin[3]
		this.sy = this.wy = this.iy + padding[0] + margin[0]

		this.$writeStart = this.view.$writeList && this.view.$writeList.length || 0
	}	

	proto.walk = function(oldturtle){

		var _w = this._w
		if(typeof _w === 'string') this._w = this.evalw(_w)
		var _h = this._h
		if(typeof _h === 'string') this._h = this.evalh(_h)

		var _x = this._x
		if(typeof _x === 'string') this._x = this.evalx(_x)
		var _y = this._y
		if(typeof _y === 'string') this._y = this.evaly(_y)

		// process the margin argument type
		var margin = this._margin
		if(typeof margin !== 'object'){
			margin = this.$margin2 || (this.$margin2 = [0,0,0,0])
			margin[0] = margin[1] = margin[2] = margin[3] = this._margin
		}

		// check if we wrap around
		if(this.outer && this.outer._wrap && !isNaN(this.width) && this.wx + this._w + margin[3] + margin[1] > this.sx + this.width){
			var dx = this.sx - this.wx 
			var dy = this.mh
			this.wx = this.sx
			this.wy += this.mh
			this.mh = 0
			// move the body of the wrapped thing
			if(oldturtle){
				this.view.$moveWritten(oldturtle.$writeStart, dx, dy)
			}
		}
		// walk it
		if(isNaN(this._x) || isNaN(this._y)){
			this._x = this.wx + margin[3]
			this._y = this.wy + margin[0]
			this.wx += this._w +margin[3] + margin[1]
			// compute new max height
			var nh = this._h +margin[0] + margin[2]
			if(nh > this.mh) this.mh = nh
			// compute x bounds
			if(this.wx > this.x2) this.x2 = this.wx
			// compute y bounds
			var ny = this.wy + nh
			if(ny > this.y2) this.y2 = ny
		}
	}

	proto.lineBreak = function(){
		this.wx = this.sx
		this.wy += this.mh
		this.mh = 0
	}

	proto.end = function(){
		var padding = this.padding
		var outer = this.outer

		outer._w = (isNaN(this.width)?(this.x2 - this.sx):this.width) + padding[3] + padding[1]
		outer._h = (isNaN(this.height)?(this.y2 - this.sy):this.height) + padding[0] + padding[2]

		// align
		if(this.align[0] !== 0 || this.align[1] !== 0){
			var dx = isNaN(this.width)? 0: (this.width - (this.x2 - this.sx)) * this.align[0]
			var dy = isNaN(this.height)? 0: (this.height - (this.y2 - this.sy)) * this.align[1]
			if(isNaN(dx) || dx === Infinity) dx = 0
			if(isNaN(dy) || dy === Infinity) dy = 0
			if(dx !== 0 || dy !== 0) this.view.$moveWritten(this.writeStart, dx, dy)		
		}
	}

	// evaluators of string x/y/w/h

	var xcache = {}
	proto.evalx = function(str){
		var cache = xcache[str]
		if(!cache){
			var rep = str.replace(/[\$\^]/g,'')
			var code
			if(str.indexOf('$') !== -1) code = 'this.turtle.sx + this.turtle.width-this.turtle._w - '+rep
			else code = 'this.turtle.sx + '+rep
			cache = xcache[str] = new Function('return '+code)
		} 
		return cache.call(this.view)
	}

	var ycache = {}
	proto.evaly = function(str){
		var cache = ycache[str]
		if(!cache){
			var rep = str.replace(/[\$\^]/g,'')
			var code
			if(str.indexOf('$') !== -1) code = 'this.turtle.sy + this.turtle.height-this.turtle._h - '+rep
			else code = 'this.turtle.sy + '+rep
			cache = ycache[str] = new Function('return '+code)
		} 
		return cache.call(this.view)
	}

	var wcache = {}
	proto.evalw = function(str){
		var cache = wcache[str]
		if(!cache){
			var code = str.replace(/\%/g, '*0.01*this.turtle.width')
			cache = wcache[str] = new Function('return '+code)
		} 
		return cache.call(this.view)
	}

	var hcache = {}
	proto.evalh = function(str){
		var cache = hcache[str]
		if(!cache){
			var code = str.replace(/\%/g, '*0.01*this.turtle.height')
			cache = hcache[str] = new Function('return '+code)
		} 
		return cache.call(this.view)
	}
})
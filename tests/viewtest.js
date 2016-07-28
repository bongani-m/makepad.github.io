var Div = require('canvas').extend({
	props:{
		bgColor:[1,0,0,1]
	},
	onDraw:function(){
		this.drawRect({
			w:this.$w,
			h:this.$h,
			color:this.bgColor
		})
	}
})

var Text = require('canvas').extend({
	padding:10,
	onDraw:function(){
		this.beginRect(this.viewGeom)
		this.drawText({
			color:'white',
			text:this.text
		})
		this.endRect()
	}
})

var Scrollbars = require('canvas').extend({
	tools:{
		Button:require('stamps/buttonstamp').extend({
			Bg:{
				borderWidth:1,
			}
		}),
		ScrollBar:require('stamps/scrollbarstamp').extend({
			ScrollBar:{
				pixelStyle2:function(){
					this.handlePos = (.5+.5*sin(2.*this.time+this.id*0.2))*(1.-this.handleSize)
				}
			}
		})
	},
	onDraw:function(){
		this.beginRect(this.viewGeom)
		for(var i = 0; i < 400; i++){
			if(i%20 === 0){
				this.drawText({
					text:'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.\n'
				})
			}
			this.drawButton({
				fontSize:20,
				outlineWidth:1,
				outlineColor:'black',
				color:'white',
				text:(i+'')
			})	
			this.drawScrollBar({
				id:i,
				margin:1,
				handleSize:0.2,
				w:10,
				h:50//'100%',
			})
		}
		this.endRect()
	}
})

var App = require('app').extend({
	onCompose:function(){
		return [
			/*Text({
				margin:10,
				text:'TextNode'
			}),*/
			Scrollbars({
				margin:10,
				padding:10,
				w:'100%',
				h:'100%'
			})/*,
			Div({
				surface:true,
				margin:10,
				bgColor:'gray'},
				Div({
					margin:10,
					bgColor:'orange',
					padding:20,
					onFingerDown:function(){
						this.w = 40
						this.margin = 40
						this.bgColor = 'blue'
					}},
					Div({
						x:'0',
						w:10,
						h:10
					})
				)
			)*/
		]
	}
})()
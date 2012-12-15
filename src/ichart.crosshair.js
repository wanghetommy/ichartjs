
	/**
	 * @overview this element simulate the crosshair on the coordinate.actually this composed of some div of html. 
	 * @component#iChart.CrossHair
	 * @extend#iChart.Html
	 */
	iChart.CrossHair = iChart.extend(iChart.Html,{
		configure:function(){
		
			/**
			 * invoked the super class's configuration
			 */
			iChart.CrossHair.superclass.configure.apply(this,arguments);
			
			/**
			 * indicate the component's type
			 */
			this.type = 'crosshair';
			
			this.set({
				/**
				 * @inner {Number} Specifies the position top,normally this will given by chart.(default to 0)
				 */
				 top:0,
				 /**
				 * @inner {Number} Specifies the position left,normally this will given by chart.(default to 0)
				 */
				 left:0,
				 /**
				 * @inner {Boolean} private use
				 */
				 hcross:true,
				  /**
				 * @inner {Boolean} private use
				 */
				 vcross:true,
				 /**
				 * @inner {Function} private use
				 */
				 invokeOffset:null,
				 /**
				 * @cfg {Number} Specifies the linewidth of the crosshair.(default to 1)
				 */
				 line_width:1,
				 /**
				 * @cfg {Number} Specifies the linewidth of the crosshair.(default to 1)
				 */
				 line_color:'#1A1A1A',
				 delay:200
			});
		},
		/**
		 * this function will implement at every target object,and this just default effect
		 */
		follow:function(e,m){
			if(this.get('invokeOffset')){
				var o = this.get('invokeOffset')(e,m);
				if(o&&o.hit){
					this.position(o.top-this.top,o.left-this.left);
				}
				return false;
			}else{
				/**
				 * set the 1px offset will make the line at the top left all the time
				 */
				this.position(e.y-this.top-1,e.x-this.left-1);
			}
			return true;
		},
		position:function(t,l){
			this.horizontal.style.top = (t-this.size)+"px";
			this.vertical.style.left = (l-this.size)+"px";
		},
		beforeshow:function(e,m){
			if(!this.follow(e,m)){
				this.position(-99,-99);
			}
		},
		doCreate:function(_,w,h){
			var d = document.createElement("div");
			d.style.width= iChart.toPixel(w);
			d.style.height= iChart.toPixel(h);
			d.style.backgroundColor = _.get('line_color');
			d.style.position="absolute";
			_.dom.appendChild(d);
			return d;
		},
		initialize:function(){
			iChart.CrossHair.superclass.initialize.call(this);
			
			var _ = this._(),L = iChart.toPixel(_.get('line_width'));
			
			_.top = iChart.fixPixel(_.get(_.O));
			_.left = iChart.fixPixel(_.get(_.L));
			
			_.dom = document.createElement("div");
			
			_.dom.style.zIndex=_.get('index');
			_.dom.style.position="absolute";
			/**
			 * set size zero make integration with vertical and horizontal
			 */
			_.dom.style.width= iChart.toPixel(0);
			_.dom.style.height=iChart.toPixel(0);
			_.dom.style.top=iChart.toPixel(_.get(_.O));
			_.dom.style.left=iChart.toPixel(_.get(_.L));
			_.css('visibility','hidden');
			
			_.horizontal = _.doCreate(_,_.get('hcross')?iChart.toPixel(_.get(_.W)):"0px",L);
			_.vertical = _.doCreate(_,L,_.get('vcross')?iChart.toPixel(_.get(_.H)):"0px");
			_.size = _.get('line_width')/2;
			
			if(_.get('shadow')){
				_.dom.style.boxShadow = _.get('shadowStyle');
			}
			
			_.wrap.appendChild(_.dom);
			
			_.T.on('mouseover',function(c,e,m){
				_.show(e,m);	
			}).on('mouseout',function(c,e,m){
				_.hidden(e,m);	
			}).on('mousemove',function(c,e,m){
				_.follow(e,m);
			});
			
		}
});
/**
 * @end
 */
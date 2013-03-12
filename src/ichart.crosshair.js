
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
		follow:function(e,m,_){
			if(_.get('invokeOffset')){
				var o = _.get('invokeOffset')(e,m);
				if(o&&o.hit){
					_.o_valid = true;
					_.position(o.top-_.top,o.left-_.left,_);
				}else if(!o||!_.o_valid){
					_.position(_.owidth,_.oheight,_);
				}
			}else{
				/**
				 * set the 1px offset will make the line at the top left all the time
				 */
				_.position(e.y-_.top-1,e.x-_.left-1,_);
			}
		},
		position:function(t,l,_){
			_.horizontal.style.top = (t-_.size)+"px";
			_.vertical.style.left = (l-_.size)+"px";
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
		doAction:function(_){
			_.T.on('mouseover',function(c,e,m){
				_.show(e,m);	
			}).on('mouseout',function(c,e,m){
				_.hidden(e,m);	
			}).on('mousemove',function(c,e,m){
				_.follow(e,m,_);
			});
		},
		initialize:function(){
			iChart.CrossHair.superclass.initialize.call(this);
			
			var _ = this._(),L = iChart.toPixel(_.get('line_width'));
			
			_.size = _.get('line_width')/2;
			
			_.top = iChart.fixPixel(_.get(_.O));
			_.left = iChart.fixPixel(_.get(_.L));
			_.owidth = -_.T.root.width;
			_.oheight = -_.T.root.height;
			_.o_valid = false;
			/**
			 * set size zero make integration with vertical and horizontal
			 */
			_.css('width','0px');
			_.css('height','0px');
			_.css('top',_.top+'px');
			_.css('left',_.left+'px');
			_.css('visibility','hidden');
			
			_.horizontal = _.doCreate(_,_.get('hcross')?iChart.toPixel(_.get(_.W)):"0px",L);
			_.vertical = _.doCreate(_,L,_.get('vcross')?iChart.toPixel(_.get(_.H)):"0px");
			
			
			
		}
});
/**
 * @end
 */
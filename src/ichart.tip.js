 	/**
	 * @overview the tip component.
	 * @component#iChart.Tip
	 * @extend#iChart.Element
	 */
	iChart.Tip = iChart.extend(iChart.Html,{
		configure:function(){
			
			/**
			 * invoked the super class's configuration
			 */
			iChart.Tip.superclass.configure.apply(this,arguments);
			
			/**
			 * indicate the legend's type
			 */
			this.type = 'tip';
			
			this.set({
				name:'',
				index:0,
				value:'',
				/**
				 * @cfg {String} Specifies the text want to disply.(default to '')
				 */
				 text:'',
				 /**
					 * @cfg {String} Specifies the tip's type.(default to 'follow') Available value are:
					 * @Option follow
					 * @Option fixed
					 */
				 showType:'follow',
				 /**
					 * @cfg {Function} Specifies Function to calculate the position.(default to null)
					 */
				 invokeOffset:null,
				 /**
					 * @cfg {Number} Specifies the duration when fadeIn/fadeOut in millisecond.(default to 300)
					 */
				 fade_duration:300,
				 /**
					 * @cfg {Number} Specifies the duration when move in millisecond.(default to 100)
					 */
				 move_duration:100,
				 /**
				  * ease
				  * linear
				  * ease-in
				  * ease-out
				  * ease-in-out
				  */
				 timing_function:'ease-out',
				 /**
					 * @cfg {Boolean} if calculate the position every time (default to false)
					 */
				 invokeOffsetDynamic:false,
				 /**
					 * @cfg {String} Specifies the css of this Dom.
					 */
				 style:'textAlign:left;padding:4px 5px;cursor:pointer;backgroundColor:rgba(239,239,239,.85);fontSize:12px;color:black;',
				 /**
					 * @cfg {Object} Override the default as enable = true,radius = 5
					 */
				 border:{
					enable:true,
					radius : 5
				 },
				 delay:200
			});
			this.registerEvent(
					/**
					 * @event Fires when parse this tip's text.Return value will override existing.
					 * @paramter <link>iChart.Tip</link>#tip
					 * @paramter string#name the current tip's name
					 * @paramter string#value the current tip's value
					 * @paramter string#text the current tip's text
					 * @paramter int#index index of data,if there was a line
					 */
					'parseText');
		},
		position:function(t,l,_){
			_.style.top =  (t<0?0:t)+"px";
			_.style.left = (l<0?0:l)+"px";
		},
		follow:function(e,m,_){
			//_.style.width = "";
			if(_.get('invokeOffsetDynamic')){
				if(m.hit){
					if(iChart.isString(m.text)||iChart.isNumber(m.text)){
						_.text(m.name,m.value,m.text,m.i,_);
					}
					var o = _.get('invokeOffset')(_.width(),_.height(),m);
					_.position(o.top,o.left,_);
				}
			}else{
				if(_.get('showType')!='follow'&&iChart.isFunction(_.get('invokeOffset'))){
					var o = _.get('invokeOffset')(_.width(),_.height(),m);
					_.position(o.top,o.left,_);
				}else{
					_.position((e.y-_.height()*1.1-2),e.x+2,_);
				}
			}
		},
		text:function(n,v,t,i,_){
			_.dom.innerHTML = _.fireString(_, 'parseText', [_,n,v,t,i],t);
		},
		hidden:function(e){
			if(this.get('animation')){
				this.css('opacity',0);
			}else{
				this.css('visibility','hidden');
			}
		},
		doAction:function(_){
			_.T.on('mouseover',function(c,e,m){
				_.show(e,m);	
			}).on('mouseout',function(c,e,m){
				_.hidden(e);
			});
			
			if(_.get('showType')=='follow'){
				_.T.on('mousemove',function(c,e,m){
					if(_.T.variable.event.mouseover){
						setTimeout(function(){
							if(_.T.variable.event.mouseover)
								_.follow(e,m,_);
						},_.get('delay'));
					}
				});
			}
		},
		initialize:function(){
			iChart.Tip.superclass.initialize.call(this);
			
			var _ = this._();
			
			_.text(_.get('name'),_.get('value'),_.get('text'),_.get('index'),_);
			_.hidden();
			
			if(_.get('animation')){
				var m =  _.get('move_duration')/1000+'s '+_.get('timing_function')+' 0s';
				_.transition('opacity '+_.get('fade_duration')/1000+'s '+_.get('timing_function')+' 0s');
				_.transition('top '+m);
				_.transition('left '+m);
				_.onTransitionEnd(function(e){
					if(_.css('opacity')==0){
						_.css('visibility','hidden');
					}
				},false);
			}
			
		}
});
/**
 * @end
 */

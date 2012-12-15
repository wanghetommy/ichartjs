
/**
 * 
 * @overview the base class use for Html componment
 * @component#iChart.Html
 * @extend#iChart.Element
 */
iChart.Html = iChart.extend(iChart.Element,{
	configure : function(T) {
		
		/**
		 * indicate the element's type
		 */
		this.type = 'html';
		
		this.T = T;
		
		/**
		 * define abstract method
		 */
		iChart.DefineAbstract('beforeshow',this);
		
		this.set({
			 animation:true,
			 /**
			  * @inner Specifies the width of this element in pixels.
			  */
			 width:0,
			 /**
			  * @inner Specifies the height of this element in pixels.
			  */
			 height:0,
			 /**
			 * @cfg {String} Custom style specification to be applied to this element.(default to '')
			 * like this:'padding:10px;font-size:12px'
			 */
			 style:'',
			 /**
			  * @inner The z-index of this element.(default to 999)
			  */
			 index:999,
			 /**
			  * @inner The top of this element.(default to 0)
			  */
			 offset_top:0,
			 /**
			  * @inner The left of this element.(default to 0)
			  */
			 offset_left:0
		});
		
		
		this.transitions = "";
	},
	initialize:function(){
		this.wrap = this.get('wrap');
		this.dom = document.createElement("div");
		
		if(this.get('shadow')){
			this.css('boxShadow',this.get('shadow_offsetx')+'px '+this.get('shadow_offsety')+'px '+this.get('shadow_blur')+'px '+this.get('shadow_color'));
		}
		if(this.get('border.enable')){
			this.css('border',this.get('border.width')+"px "+this.get('border.style')+" "+this.get('border.color'));
			this.css('borderRadius',this.get('border.radius')+"px");
		}
		this.css('zIndex',this.get('index'));
		
		this.applyStyle();
	},
	width:function(){
		return this.dom.offsetWidth;
	},
	height:function(){
		return this.dom.offsetHeight;
	},
	onTransitionEnd:function(fn,useCapture){
		var type = 'transitionend';
		if(iChart.isWebKit){
			type = 'webkitTransitionEnd';
		}else if(iChart.isOpera){
			type = 'oTransitionEnd';
		}
		iChart.Event.addEvent(this.dom,type,fn,useCapture);
	},
	transition:function(v){
		this.transitions = this.transitions==''?v:this.transitions+','+v;
		if(iChart.isWebKit){
			this.css('WebkitTransition',this.transitions);
		}else if(iChart.isGecko){
			this.css('MozTransition',this.transitions);
		}else if(iChart.isOpera){
			this.css('OTransition',this.transitions);
		}else{
			this.css('transition',this.transitions);
		}
	},
	show:function(e,m){
		this.beforeshow(e,m);
		this.css('visibility','visible');
		if(this.get('animation')){
			this.css('opacity',1);
		}
	},
	hidden:function(e){
		this.css('visibility','hidden');
	},
	getDom:function(){
		return this.dom;
	},
	css:function(k,v){
		if(iChart.isString(k))if(iChart.isDefined(v))this.dom.style[k]=v;else return this.dom.style[k];
	},
	applyStyle:function(){
		var styles  = this.get('style').split(";"),style;
		for(var i = 0;i< styles.length;i++){
			style = styles[i].split(":");
			if(style.length>1)this.css(style[0],style[1]);
		}
	}
});
/**
 * @end
 */
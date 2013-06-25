/**
 * @overview This is base class of all element.All must extend this so that has ability for configuration and event
 * this class include some base attribute
 * @component#iChart.Element
 * @extend#Object
 */
iChart.Element = function(config) {
	var _ = this._();
	/**
	 * indicate the element's type
	 */
	_.type = 'element';
	
	_.ICHARTJS_OBJECT = true;

	/**
	 * define abstract method
	 */
	iChart.DefineAbstract('configure', _);
	iChart.DefineAbstract('afterConfiguration', _);

	/**
	 * All of the configuration will in this property
	 */
	_.options = {};

	_.set({
		/**
		 * @cfg {Object} Specifies the border for this element.
		 * Available property are:
		 * @Option enable {boolean} If enable the border
		 * @Option color {String} the border's color.(default to '#BCBCBC')
		 * @Option style {String} the border's style.(default to 'solid')
		 * @Option width {Number/String} the border's width.If given array,the option radius will be 0.(default to 1)
		 * @Option radius {Number/String} the border's radius.(default to 0)
		 */
		border : {
			enable : false,
			color : '#BCBCBC',
			style : 'solid',
			width : 1,
			radius : 0
		},
		/**
		 * @cfg {Boolean} Specifies whether the element should be show a shadow.In general there will be get a high render speed when apply false.(default to false)
		 */
		shadow : false,
		/**
		 * @cfg {String} Specifies the color of your shadow is.(default to '#666666')
		 */
		shadow_color : '#666666',
		/**
		 * @cfg {Number} Specifies How blur you want your shadow to be.(default to 4)
		 */
		shadow_blur : 4,
		/**
		 * @cfg {Number} Specifies Horizontal distance (x-axis) between the shadow and the shape in pixel.(default to 0)
		 */
		shadow_offsetx : 0,
		/**
		 * @cfg {Number} Specifies Vertical distance (y-axis) between the shadow and the shape in pixel.(default to 0)
		 */
		shadow_offsety : 0
	});
	
	/**
	 * variable for short
	 */
	_.W = 'width';
	_.H = 'height';
	_.O = 'top';
	_.B = 'bottom';
	_.L = 'left';
	_.R = 'right';
	_.C = 'center';
	_.X = 'originx';
	_.Y = 'originy';
	/**
	 * the running variable cache
	 */
	_.variable = {};
	
	/**
	 * the root of all events
	 */
	_.events = {
		'mouseup':[],
		'touchstart':[],
		'touchmove':[],
		'touchend':[],
		'mousedown':[],
		'dblclick':[]
	};
	
	_.registerEvent(
			/**
			 * @event Fires after the element initializing is finished this is for test
			 * @paramter iChart.Painter#this
			 */
			'initialize');
			
	_.initialization = false;
	
	/**
	 * inititalize configure
	 */
	_.configure.apply(_, Array.prototype.slice.call(arguments, 1));
	
	/**
	 * clone the original config
	 */
	_.default_ = iChart.clone(_.options,true);
	
	/**
	 * megre customize config
	 */
	_.set(config);
	
	_.afterConfiguration(_);
}

iChart.Element.prototype = {
	_:function(){return this},	
	afterConfiguration : function(_) {
		/**
		 * register customize event
		 */
		if (iChart.isObject(_.get('listeners'))) {
			for ( var e in _.get('listeners')) {
				_.on(e, _.get('listeners')[e]);
			}
		}
		_.initialize();
		
		/**
		 * fire the initialize event,this probable use to unit test
		 */
		_.fireEvent(_, 'initialize', [_]);
	},
	registerEvent : function() {
		for ( var i = 0; i < arguments.length; i++) {
			this.events[arguments[i]] = [];
		}
	},
	fireString : function(socpe, name, args, s) {
		var t = this.fireEvent(socpe, name, args);
		return iChart.isString(t) ? t : (t!==true&&iChart.isDefined(t)?t.toString():s);
	},
	fireEvent : function(socpe, name, args) {
		var L = this.events[name].length;
		if (L == 1)
			return this.events[name][0].apply(socpe, args);
		var r = true;
		for ( var i = 0; i < L; i++) {
			if(!this.events[name][i].apply(socpe, args))
				r  = false;
		}
		return r;
	},
	on : function(n, fn) {
		if(iChart.isString(n)&&iChart.isArray(this.events[n])){
			this.events[n].push(fn);
		}else if(iChart.isArray(n)){
			n.each(function(c){this.on(c, fn)},this);
		}
		return this;
	},
	getPlugin:function(n){
		return this.constructor.plugin_[n];
	},
	set : function(c) {
		if (iChart.isObject(c))
			iChart.merge(this.options, c);
	},
	pushIf : function(n, v) {
		if (!iChart.isDefined(this.get(n))||this.get(n)==null) {
			return this.push(n, v);
		}
		return this.get(n);
	},
	/**
	 * average write speed about 0.013ms
	 */
	push : function(n, v) {
		var A = n.split("."),L=A.length - 1,V = this.options;
		for (var i = 0; i < L; i++) {
			if (!V[A[i]])
				V[A[i]] = {};
			V = V[A[i]];
		}
		V[A[L]] = v;
		return v;
	},
	/**
	 * average read speed about 0.005ms
	 */
	get : function(n) {
		var A = n.split("."), V = this.options[A[0]];
		for (var i = 1; i < A.length; i++) {
			if (!V)
				return null;
			V = V[A[i]];
		}
		return V;
	}
}
/**
 * @end
 */


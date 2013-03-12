/**
 * @overview The interface this class defined d,so the sub class has must capability to draw and aware of event. this class is a abstract class,so you should not try to initialize it.
 * @component#iChart.Painter
 * @extend#iChart.Element
 */
iChart.Painter = iChart.extend(iChart.Element, {

	configure : function() {
		/**
		 * indicate the element's type
		 */
		this.type = 'painter';

		this.dimension = iChart._2D;

		/**
		 * define abstract method
		 */
		iChart.DefineAbstract('commonDraw', this);
		iChart.DefineAbstract('initialize', this);

		this.set({
			/**
			 * @cfg {String} Specifies the default strokeStyle of the canvas's context in this element.(defaults to 'gray')
			 */
			strokeStyle : 'gray',
			/**
			 * @cfg {Number} Specifies the padding for this element in pixel,the same rule as css padding.(defaults to 10)
			 */
			padding : 10,
			/**
			 * @cfg {String} Specifies the font's color for this element.(defaults to 'black')
			 */
			color : 'black',
			/**
			 * @cfg {Number} Specifies Horizontal offset(x-axis) in pixel.(default to 0)
			 */
			offsetx : 0,
			/**
			 * @cfg {Number}Specifies Vertical distance (y-axis) in pixel.(default to 0)
			 */
			offsety : 0,
			/**
			 * @cfg {String} Specifies the backgroundColor for this element.(defaults to 'FDFDFD')
			 */
			background_color : '#FEFEFE',
			/**
			 * @cfg {float} Specifies the factor make color dark or light for this element,relative to background-color,the bigger the value you set,the larger the color changed.scope{0.01 - 0.5}.(defaults to '0.15')
			 */
			color_factor : 0.15,
			/**
			 * @inner {String} ('2d','3d')
			 */
			style : '',
			/**
			 * @cfg {Object} Here,specify as true by default
			 */
			border : {
				enable : true
			},
			/**
			 * @cfg {Boolean} True to apply the gradient.(default to false)
			 */
			gradient : false,
			/**
			 * @cfg {String} Specifies the gradient mode of background.(defaults to 'LinearGradientUpDown')
			 * @Option 'LinearGradientUpDown'
			 * @Option 'LinearGradientDownUp'
			 * @Option 'LinearGradientLeftRight'
			 * @Option 'LinearGradientRightLeft'
			 * @Option 'RadialGradientOutIn'
			 * @Option 'RadialGradientInOut'
			 */
			gradient_mode:'LinearGradientUpDown',
			/**
			 * @cfg {Number}Specifies the z-index.(default to 0)
			 */
			z_index : 0,
			/**
			 * @cfg {Object} A config object containing one or more event handlers.(default to null)
			 */
			listeners : null,
			/**
			 * @cfg {Number} If you want to totally override the positioning of the chart,you should setting it.(default to null)
			 */
			originx : null,
			/**
			 * @cfg {Number} If you want to totally override the positioning of the chart,you should setting it.(default to null)
			 */
			originy : null
		});

		this.variable.event = {
			mouseover : false
		};
		
		this.variable.animation = {}
		/**
		 * register the common event
		 */
		this.registerEvent(
		/**
		 * @event Fires when this element is clicked
		 * @paramter iChart.Painter#this
		 * @paramter EventObject#e The click event object
		 * @paramter Object#param The additional parameter
		 */
		'click',
		/**
		 * @event Fires when the mouse move on the element
		 * @paramter iChart.Painter#this
		 * @paramter EventObject#e The mousemove event object
		 */
		'mousemove',
		/**
		 * @event Fires when the mouse hovers over the element
		 * @paramter iChart.Painter#this
		 * @paramter EventObject#e The mouseover event object
		 */
		'mouseover',
		/**
		 * @event Fires when the mouse exits the element
		 * @paramter iChart.Painter#this
		 * @paramter EventObject#e The mouseout event object
		 */
		'mouseout',
		/**
		 * @event Fires before the element drawing.Return false from an event handler to stop the draw.
		 * @paramter iChart.Painter#this
		 */
		'beforedraw',
		/**
		 * @event Fires after the element drawing when calling the draw method.
		 * @paramter iChart.Painter#this
		 */
		'draw');
		
		
	},
	is3D : function() {
		return this.dimension == iChart._3D;
	},
	applyGradient:function(x,y,w,h){
		var _ = this._();
		if(_.get('gradient')&&_.get('f_color')){
			_.push('f_color', _.T.gradient(x||_.x||0,y||_.y||0,w||_.get(_.W),h||_.get(_.H),[_.get('dark_color'), _.get('light_color')],_.get('gradient_mode')));
			_.push('light_color', _.T.gradient(x||_.x||0,y||_.y||0,w||_.get(_.W),h||_.get(_.H),[_.get('background_color'), _.get('light_color')],_.get('gradient_mode')));
			_.push('f_color_',_.get('f_color'));
		}
	},
	/**
	 * @method The commnd fire to draw the chart use configuration,
	 * this is a abstract method.Currently known,both <link>iChart.Chart</link> and <link>iChart.Component</link> implement this method.
	 * @return void
	 */
	draw : function(e,comb) {
		if(comb){
			/**
			 * fire the root Refresh
			 */
			this.root.draw(e);
		}else{
			/**
			 * fire the beforedraw event
			 */
			if (!this.fireEvent(this, 'beforedraw', [this,e])) {
				return this;
			}
			/**
			 * execute the commonDraw() that the subClass implement
			 */
			this.commonDraw(this,e);
	
			/**
			 * fire the draw event
			 */
			this.fireEvent(this, 'draw', [this,e]);
		}
	},
	inject : function(c) {
		if (c) {
			this.root = c;
			this.target = this.T = c.T;
		}
	},
	doConfig : function() {
		
		var _ = this._(), p = iChart.parsePadding(_.get('padding')), b = _.get('border.enable'), b = b ? iChart.parsePadding(_.get('border.width')) : [0, 0, 0, 0], bg = iChart.toRgb(_.get('background_color')), f = _.get('color_factor'),g=_.get('gradient')?0:null;
		
		_.set({
			border_top:b[0],
			border_right:b[1],
			border_bottom:b[2],
			border_left:b[3],
			hborder:b[1] + b[3],
			vborder:b[0] + b[2],
			padding_top:p[0] + b[0],
			padding_right:p[1] + b[1],
			padding_bottom:p[2] + b[2],
			padding_left:p[3] + b[3],
			hpadding:p[1] + p[3] + b[1] + b[3],
			vpadding:p[0] + p[2] + b[0] + b[2]
		});	
		
		if (_.get('shadow')===true) {
			_.push('shadow', {
				color : _.get('shadow_color'),
				blur : _.get('shadow_blur'),
				offsetx : _.get('shadow_offsetx'),
				offsety : _.get('shadow_offsety')
			});
		}
		
		_.push('f_color', bg);
		_.push('f_color_', bg);
		_.push("light_color", iChart.light(bg, f,g));
		_.push("dark_color", iChart.dark(bg, f*0.8,g));
		_.push("light_color2", iChart.light(bg, f * 2,g));
		
		if(_.is3D()&&!_.get('xAngle_')){
			var P = iChart.vectorP2P(_.get('xAngle'),_.get('yAngle'));
			_.push('xAngle_',P.x);
			_.push('yAngle_',P.y);
		}
	}
});
/**
 * @end
 */
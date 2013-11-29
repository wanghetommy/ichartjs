/**
 * @overview this a abstract component of all concrete chart
 * @component#iChart.Component
 * @extend#iChart.Painter
 */
iChart.Component = iChart.extend(iChart.Painter, {
	configure : function(c) {
		/**
		 * invoked the super class's configuration
		 */
		iChart.Component.superclass.configure.apply(this, arguments);

		/**
		 * indicate the element's type
		 */
		this.type = 'component';

		this.set({
			/**
			 * @cfg {Number} Specifies the font size of this element in pixels.(default to 12)
			 */
			fontsize : 12,
			/**
			 * @cfg {String} Specifies the font of this element.(default to 'Verdana')
			 */
			font : 'Verdana',
			/**
			 * @cfg {String} Specifies the font weight of this element.(default to 'normal')
			 */
			fontweight : 'normal',
			/**
			 * @cfg {String} Specifies the unit of font-size.(default to 'px')
			 */
			fontunit:'px',
			/**
			 * @inner {Boolean} Specifies the config of Tip.For details see <link>iChart.Tip</link> Note:this has a extra property named 'enable',indicate whether tip available(default to false)
			 */
			tip : {
				enable : false,
				border : {
					width : 2
				}
			}
		});

		/**
		 * If this element can split or contain others.(default to false)
		 */
		this.atomic = false;
		/**
		 * If method draw be proxy.(default to false)
		 */
		this.proxy = false;
		this._chart = false;
		this.inject(c);
	},
	initialize : function() {
		iChart.DefineAbstract('isEventValid', this);
		iChart.DefineAbstract('doDraw', this);
		
		this.doConfig();
	},
	/**
	 * @method return the component's dimension,return hold following property
	 * @property x:the left-top coordinate-x
	 * @property y:the left-top coordinate-y
	 * @property width:the width of component,note:available there applies box model
	 * @property height:the height of component,note:available there applies box model
	 * @return object
	 */
	getDimension : function() {
		return {
			x : this.x,
			y : this.y,
			width : this.get("width"),
			height : this.get("height")
		}
	},
	destroy:function(){
		if(this.tip){
			this.tip.destroy();
		}
	},
	doConfig : function() {
		iChart.Component.superclass.doConfig.call(this);
		var _ = this._(),w = _.get(_.W),W = _.get('maxwidth'),x = _.get(_.X);
		if(w&&W){
			w = _.push(_.W,iChart.parsePercent(w,W));
			if(w>W){
				w = _.push('width',W);
			}
			if(W>w){
				var C = _.get('align')||_.C;
				if(C == _.C){
					x +=(W-w)/2;
				}else if(C == _.R){
					x += (W-w);
				}
			}
		}
		
		_.x = _.push(_.X, x + _.get('offsetx'));
		_.y = _.push(_.Y, _.get(_.Y) + _.get('offsety'));
		
		_.push('fontStyle', iChart.getFont(_.get('fontweight'), _.get('fontsize'), _.get('font'),_.get('fontunit')));
		
		/**
		 * if have evaluate it
		 */
		_.data = _.get('data');
		
		if (_.get('tip.enable')) {
			/**
			 * make tip's border in accord with sector
			 */
			_.pushIf('tip.border.color', _.get('f_color'));

			if (!iChart.isFunction(_.get('tip.invokeOffset')))
				/**
				 * indicate the tip must calculate position
				 */
				_.push('tip.invokeOffset', _.tipInvoke());
		}

	},
	isMouseOver : function(e) {
		return this.isEventValid(e,this);
	},
	redraw : function(e) {
		this.root.draw(e,this.root.Combination);
	},
	last:iChart.emptyFn,
	commonDraw : function(_) {
		/**
		 * execute the doDraw() that the subClass implement
		 */
		if (!_.proxy)
			_.doDraw.call(_,_);

	}
});
/**
 * @end
 */

/**
 * @overview this class is abstract,use for config bar
 * @component#iChart.Bar
 * @extend#iChart.Chart
 */
iChart.Bar = iChart.extend(iChart.Chart, {
	/**
	 * initialize the context for the bar
	 */
	configure : function() {
		/**
		 * invoked the super class's configuration
		 */
		iChart.Bar.superclass.configure.call(this);

		this.type = 'bar';
		this.set({
			/**
			 * @cfg {<link>iChart.Coordinate2D</link>} the option for coordinate.
			 */
			coordinate : {
				striped_direction : 'h'
			},
			/**
			 * @cfg {Number} Specifies the width of each bar(default to calculate according to coordinate's height)
			 */
			barheight : undefined,
			/**
			 * @cfg {Number} Specifies the distance of bar's bottom and text(default to 6)
			 */
			text_space : 6,
			/**
			 * @cfg {String} Specifies the align of scale(default to 'bottom') Available value are:
			 * @Option 'bottom'
			 */
			scaleAlign : 'bottom',
			/**
			 * @cfg {<link>iChart.Rectangle</link>} Specifies option of rectangle.
			 */
			sub_option : {},
			/**
			 * @cfg {<link>iChart.Text</link>} Specifies option of label at left.
			 */
			label : {}
		});
	},
	/**
	 * @method Returns the coordinate of this element.
	 * @return iChart.Coordinate2D
	 */
	getCoordinate : function() {
		return this.coo;
	},
	doLabel : function(id, text, x, y) {
		this.labels.push(new iChart.Text(iChart.apply(this.get('label'), {
			id : id,
			text : text,
			textAlign : 'right',
			textBaseline : 'middle',
			originx : x,
			originy : y
		}), this));
	},
	doParse : function(_, d, i, o) {
		_.doActing(_, d, o,i);
	},
	doAnimation : function(t, d,_) {
		_.coo.draw();
		_.labels.each(function(l) {
			l.draw();
		});
		_.rectangles.each(function(r) {
			r.push(_.W, Math.ceil(_.animationArithmetic(t, 0, r.width, d)));
			r.drawRectangle();
		});
	},
	doConfig : function() {
		iChart.Bar.superclass.doConfig.call(this);

		var _ = this._(), b = 'barheight', z = 'z_index';
		/**
		 * Apply the coordinate feature
		 */
		iChart.Coordinate.coordinate.call(_);

		_.rectangles = [];
		_.labels = [];
		_.rectangles.zIndex = _.get(z);
		_.labels.zIndex = _.get(z) + 1;
		_.components.push(_.labels);
		_.components.push(_.rectangles);

		var L = _.data.length, H = _.get('coordinate.valid_height'),h_,bh,KL;
		
		if (_.dataType == 'simple') {
			h_= Math.floor(H*2 / (L * 3 + 1));
			bh = _.pushIf(b, h_);
			KL = L+1;
		}else{
			KL = _.get('labels').length;
			L = KL * L + (_.is3D()?(L-1)*KL*_.get('group_fator'):0);
			h_= Math.floor(H / (KL + 1 + L));
			bh = _.pushIf(b,h_);
			KL +=1;
		}
		
		if (bh * L > H) {
			bh = _.push(b, h_);
		}
		/**
		 * the space of two bar
		 */
		_.push('barspace', (H - bh * L) / KL);

		/**
		 * use option create a coordinate
		 */
		_.coo = iChart.Coordinate.coordinate_.call(_);

		_.components.push(_.coo);

		/**
		 * quick config to all rectangle
		 */
		_.push('sub_option.height', bh);
		_.push('sub_option.valueAlign', _.R);
		_.push('sub_option.tipAlign', _.R);
	}

});
/**
 * @end
 */

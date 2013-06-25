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
			bar_height : undefined,
			/**
			 * @cfg {Number} the space of each column.this option is readOnly.(default to undefined)
			 */
			bar_space : undefined,
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
	doLabel : function(_,id, text, x, y) {
		_.labels.push(new iChart.Text(iChart.apply(_.get('label'), {
			id : id,
			text : text,
			textAlign : 'right',
			textBaseline : 'middle',
			originx : x,
			originy : y
		}), _));
	},
	doParse : function(_, d, i, o) {
		_.doActing(_, d, o,i);
	},
	engine:function(_){
		var bh = _.get('bar_height'),
		s = _.get('bar_space'),
		S = _.coo.getScale(_.get('scaleAlign')),
		W = _.coo.valid_width,
		h2 = bh / 2,
		gw =  _.dataType != 'complex'?bh + s:_.data.length * bh + s,
		x = _.coo.get('x_start')+ S.basic * W,
		x0 = _.coo.get(_.X) - _.get('text_space')-_.coo.get('axis.width')[3], 
		y0 = _.coo.get('y_start')+ s;
		
		_.doEngine(_,bh,s,S,W,h2,gw,x,x0,y0);
	},
	doAnimation : function(t, d,_) {
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

		var _ = this._(), b = 'bar_height', z = 'z_index';
		
		_.rectangles = [];
		_.labels = [];
		_.rectangles.zIndex = _.get(z);
		_.labels.zIndex = _.get(z) + 1;
		_.components.push(_.labels);
		_.components.push(_.rectangles);
		
		/**
		 * use option create a coordinate
		 */
		_.coo = iChart.Coordinate.coordinate_.call(_,function(){
			var L = _.data.length, H = _.get('coordinate.valid_height_value'),h_,bh,KL;
			
			if (_.dataType == 'complex') {
				KL = _.get('labels').length;
				L = KL * L + (_.is3D()?(L-1)*KL*_.get('group_fator'):0);
				h_= Math.floor(H / (KL + 1 + L));
				bh = _.pushIf(b,h_);
				KL +=1;
			}else{
				if(_.dataType == 'stacked'){
					L = _.get('labels').length;
				}
				h_= Math.floor(H*2 / (L * 3 + 1));
				bh = _.pushIf(b, h_);
				KL = L+1;
			}
			
			if (bh * L > H) {
				bh = _.push(b, h_);
			}
			/**
			 * the space of two bar
			 */
			_.push('bar_space', (H - bh * L) / KL);
			
		});
		
		/**
		 * quick config to all rectangle
		 */
		_.push('sub_option.height', _.get(b));
		_.push('sub_option.valueAlign', _.R);
		_.push('sub_option.tipAlign', _.R);
	}

});
/**
 * @end
 */

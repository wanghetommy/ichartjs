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
			 * @cfg {Number} Specifies the width of each bar(default to calculate according to coordinate's height)
			 */
			bar_height : '66%',
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
		this.rectangles = [];
		this.labels = [];
		this.components.push(this.labels);
		this.components.push(this.rectangles);
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
	rect:function(_,d, i,x,y,W,S,So){
		var v = d.value;
		if(_.get('percent')){
			v = v*100/ d.total;
		}
		var w = So.getMark(v,S) * W;
		_.doParse(_, d, i, {
			id : i,
			originx : x - (w > 0 ? 0 : Math.abs(w)),
			originy : y,
			width : Math.abs(w)
		});
		_.rectangles.push(new iChart.Rectangle2D(_.get('sub_option'), _));
		return w;
	},
	engine:function(_){
		if(_.isE())return;
		var bh = _.get('_bar_height'),
		s = _.get('bar_space'),
		So = _.coo.getScaleObj(_.get('scaleAlign')),
		S = So.getScale(So),
		W = _.coo.valid_width,
		h2 = bh / 2,
		gw =  _.dataType != 'complex'?bh + s:_.data.length * bh + s,
		x = _.coo.get('x_start')+ S.basic * W,
		x0 = _.coo.get(_.X) - _.get('text_space')-_.coo.get('axis.width')[3], 
		y = _.coo.get('y_start')+ s;
		
		_.doEngine(_,bh,s,S,So,W,h2,gw,x,y,x0);
	},
	doAnimation : function(t, d,_) {
        iChart.each(_.labels,function(l) {
			l.draw();
		});
        iChart.each(_.rectangles,function(r) {
			r.push(_.W, Math.ceil(_.animationArithmetic(t, 0, r.width, d)));
			r.drawRectangle();
		});
	},
	doConfig : function() {
		iChart.Bar.superclass.doConfig.call(this);

		var _ = this._(), z = 'z_index';
		
		_.rectangles.length = 0;
		_.labels.length = 0;
		
		_.rectangles.zIndex = _.get(z);
		_.labels.zIndex = _.get(z) + 1;

		if(!_.Combination){
			_.pushIf('coordinate.scale', [
				iChart.apply(_.get('coordinate.xAxis'), {
					maxValue: _.get('maxValue'),
					minValue: _.get('minValue')
				})]);
		}
		
		/**
		 * use option create a coordinate
		 */
		_.coo = iChart.Coordinate.coordinate_.call(_,function(vw,H){
			var L = _.data.length,KL;
			
			if (_.dataType == 'complex') {
				KL = _.get('labels').length;
				L = KL * L + (_.is3D()?(L-1)*KL*_.get('group_fator'):0);
				KL +=1;
			}else{
				if(_.dataType == 'stacked'){
					L = _.get('labels').length;
				}
				KL = L+1;
			}
			/**
			 * the space of two bar
			 */
			_.push('bar_space', (H - _.push('sub_option.height',_.push('_bar_height',iChart.parsePercent(_.get('bar_height'),Math.floor(H/L)))) * L) / KL);
		});
		
		/**
		 * quick config to all rectangle
		 */
		_.push('sub_option.valueAlign', _.R);
		_.push('sub_option.tipAlign', _.R);
	}

});
/**
 * @end
 */

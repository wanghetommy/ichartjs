/**
 * @overview this component will draw a line2d chart.
 * @component#@chart#iChart.LineBasic2D
 * @extend#iChart.Line
 */
iChart.LineBasic2D = iChart.extend(iChart.Line, {
	/**
	 * initialize the context for the LineBasic2D
	 */
	configure : function() {
		/**
		 * invoked the super class's configuration
		 */
		iChart.LineBasic2D.superclass.configure.call(this);

		this.type = 'basicline2d';

		this.tipInvokeHeap = [];
	},
	doAnimation : function(t, d,_) {
		_.lines.each(function(l){
			l.get('points').each(function(p){
				p.y = l.y - Math.ceil(_.animationArithmetic(t, 0, l.y - p.y_, d));
			});
			l.drawSegment();
		});
	},
	doConfig : function() {
		iChart.LineBasic2D.superclass.doConfig.call(this);
		var _ = this._();
		
		/**
		 * get the max/min scale of this coordinate for calculated the height
		 */
		var S, H = _.coo.valid_height, sp = _.get('point_space'), points, x, y, 
		ox = _.get('sub_option.originx'), oy, p;
		
		_.push('sub_option.tip.showType', 'follow');
		_.push('sub_option.coordinate', _.coo);
		_.push('sub_option.tipInvokeHeap', _.tipInvokeHeap);
		_.push('sub_option.point_space', sp);
		_.data.each(function(d, i) {
			S = _.coo.getScale(d.scaleAlign||_.get('scaleAlign'));
			oy = _.get('sub_option.originy')- S.basic*H;
			points = [];
			d.value.each(function(v, j) {
				x = sp * j;
				y = (v - S.start) * H / S.distance;
				p = {
					x : ox + x,
					y : oy - y,
					value : v,
					text : d.name+' '+v
				};
				iChart.merge(p, _.fireEvent(_, 'parsePoint', [d, v, x, y, j,S]));
				points.push(p);
			}, _);
			/**
			 * merge the option
			 */
			iChart.merge(_.get('sub_option'),d);
			
			_.push('sub_option.points', points);
			_.push('sub_option.brushsize', d.linewidth || d.line_width);
			_.lines.push(new iChart.LineSegment(_.get('sub_option'), _));
		}, this);
	}
});
iChart.register('LineBasic2D');
/**
 * @end
 */

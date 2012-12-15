/**
 * @overview this component will draw a bar2d chart.
 * @component#@chart#iChart.Bar2D
 * @extend#iChart.Bar
 */
iChart.Bar2D = iChart.extend(iChart.Bar, {
	/**
	 * initialize the context for the pie
	 */
	configure : function() {
		/**
		 * invoked the super class's configuration
		 */
		iChart.Bar2D.superclass.configure.call(this);

		this.type = 'bar2d';

	},
	doConfig : function() {
		iChart.Bar2D.superclass.doConfig.call(this);
		/**
		 * get the max/min scale of this coordinate for calculated the height
		 */
		var _ = this._(),
			h = _.get('barheight'),
			b = _.get('barspace'),
			S = _.coo.getScale(_.get('scaleAlign')),
			W = _.coo.get(_.W),
			h2 = h / 2,
			gw = h + b,
			w,
			I = _.coo.get(_.X) + S.basic * W,
			x0 = _.coo.get(_.X) - _.get('text_space')-_.coo.get('axis.width')[3], 
			y0 = _.coo.get('y_start')+ b;
		
		_.data.each(function(d, i) {
			w = (d.value - S.start) * W / S.distance;
			_.doParse(_, d, i, {
				id : i,
				originy : y0 + i * gw,
				width : Math.abs(w),
				originx : I + (w > 0 ? 0 : -Math.abs(w))
			});

			_.rectangles.push(new iChart.Rectangle2D(_.get('sub_option'), _));
			_.doLabel(i, d.name, x0, y0 + i * gw + h2);
		}, _);
	}

});
/**
 * @end
 */

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
	doEngine:function(_,bh,s,S,W,h2,gw,x,x0,y0){
		var w;
		_.data.each(function(d, i) {
			w = (d.value - S.start) * W / S.distance;
			_.doParse(_, d, i, {
				id : i,
				originy : y0 + i * gw,
				width : Math.abs(w),
				originx : x + (w > 0 ? 0 : -Math.abs(w))
			});

			_.rectangles.push(new iChart.Rectangle2D(_.get('sub_option'), _));
			_.doLabel(_,i, d.name, x0, y0 + i * gw + h2);
		}, _);
	},
	doConfig : function() {
		iChart.Bar2D.superclass.doConfig.call(this);
		/**
		 * start up engine
		 */
		this.engine(this);
	}
});
iChart.register('Bar2D');
/**
 * @end
 */

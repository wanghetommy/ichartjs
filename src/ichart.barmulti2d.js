/**
 * @overview this component will draw a cluster bar2d chart.
 * @component#@chart#iChart.BarMulti2D
 * @extend#iChart.Bar
 */
iChart.BarMulti2D = iChart.extend(iChart.Bar, {
	/**
	 * initialize the context for the BarMulti2D
	 */
	configure : function() {
		/**
		 * invoked the super class's configuration
		 */
		iChart.BarMulti2D.superclass.configure.call(this);

		this.type = 'barmulti2d';
		this.dataType = 'complex';

		this.set({
			/**
			 * @cfg {Array} the array of labels close to the axis
			 */
			labels : []
		});
	},
	doEngine:function(_,bh,s,S,W,h2,gw,x,x0,y0){
		var w;
		_.columns.each(function(c, i) {
			c.item.each(function(d, j) {
				w = (d.value - S.start) * W / S.distance;
				_.doParse(_, d, j, {
					id : i + '_' + j,
					originy : y0 + j * bh + i * gw,
					width : Math.abs(w),
					originx: x+(w>0?0:-Math.abs(w))
				});
				_.rectangles.push(new iChart.Rectangle2D(_.get('sub_option'), _));
			}, _);
			_.doLabel(_,i, c.name, x0, y0 - s * 0.5 + (i + 0.5) * gw);
		}, _);
	},
	doConfig : function() {
		iChart.BarMulti2D.superclass.doConfig.call(this);
		/**
		 * start up engine
		 */
		this.engine(this);
	}
});
iChart.register('BarMulti2D');
/**
 * @end
 */

/**
 * @overview this component will draw a cluster column2d chart.
 * @component#@chart#iChart.ColumnMulti2D
 * @extend#iChart.Column
 */
iChart.ColumnMulti2D = iChart.extend(iChart.Column, {
	/**
	 * initialize the context for the ColumnMulti2D
	 */
	configure : function() {
		/**
		 * invoked the super class's configuration
		 */
		iChart.ColumnMulti2D.superclass.configure.call(this);

		this.type = 'columnmulti2d';
		this.dataType = 'complex';

		this.set({
			/**
			 * @cfg {Array} the array of labels close to the axis
			 */
			labels : []
		});

	},
	doEngine:function(_,cw,s,S,H,w2,q,gw,x,y,y0){
		var h;
		_.columns.each(function(c, i) {
			c.item.each(function(d, j) {
				h = (d.value - S.start) * H / S.distance;
				_.doParse(_, d, j, {
					id : i + '_' + j,
					originx : x + j * (cw + q) + i * gw,
					originy : y - (h > 0 ? h : 0),
					height : Math.abs(h)
				});
				_.rectangles.push(new iChart[_.sub](_.get('sub_option'), _));
			}, _);

			_.doLabel(_, i, c.name, x - s * 0.5 + (i + 0.5) * gw, y0);
		}, _);
	},
	doConfig : function() {
		iChart.ColumnMulti2D.superclass.doConfig.call(this);

		/**
		 * start up engine
		 */
		this.engine(this);
	}
});
iChart.register('ColumnMulti2D');
/**
 * @end
 */

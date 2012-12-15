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
	doConfig : function() {
		iChart.ColumnMulti2D.superclass.doConfig.call(this);

		/**
		 * get the max/min scale of this coordinate for calculated the height
		 */
		var _ = this._(),
			s = _.get('hispace'),
			bw = _.get('colwidth'), 
			H = _.coo.get(_.H), 
			S = _.coo.getScale(_.get('scaleAlign')), 
			q = bw * (_.get('group_fator') || 0), 
			gw = _.data.length * bw + s + (_.is3D() ? (_.data.length - 1) * q : 0), 
			h,
			x = _.coo.get('x_start') + s,
			y = _.coo.get(_.Y) - S.basic * H + H,
			y0=_.coo.get(_.Y) + H + _.get('text_space')+ _.coo.get('axis.width')[2];
		
		_.columns.each(function(column, i) {
			column.item.each(function(d, j) {
				h = (d.value - S.start) * H / S.distance;
				_.doParse(_, d, j, {
					id : i + '-' + j,
					originx : x + j * (bw + q) + i * gw,
					originy : y - (h > 0 ? h : 0),
					height : Math.abs(h)
				});
				_.rectangles.push(new iChart[_.sub](_.get('sub_option'), this));
			}, _);

			_.doLabel(_, i, column.name, x - s * 0.5 + (i + 0.5) * gw, y0);
		}, _);

	}
});
/**
 * @end
 */

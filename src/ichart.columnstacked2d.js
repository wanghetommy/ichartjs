/**
 * @overview the stacked column2d componment
 * @component#@chart#iChart.ColumnStacked2D
 * @extend#iChart.Column
 */
iChart.ColumnStacked2D = iChart.extend(iChart.Column, {
	/**
	 * initialize the context for the ColumnStacked2D
	 */
	configure : function() {
		/**
		 * invoked the super class's configuration
		 */
		iChart.ColumnStacked2D.superclass.configure.call(this);

		this.type = 'columnstacked2d';
		/**
		 * indicate the data structure
		 */
		this.dataType = 'stacked';
		
		this.set({
			/**
			 * @cfg {Boolean} Specifies as true to display with percent.(default to false)
			 */
			percent : false,
			/**
			 * @cfg {Array} the array of labels close to the axis
			 */
			labels : [],
			sub_option:{
				label:{color:'#ffffff'},
				valueAlign:'middle'
			}
		});
		
	},
	doEngine:function(_,cw,s,S,H,w2,q,gw,x,y,y0){
		var h0,h,v,p = _.get('percent');
		_.columns.each(function(c, i) {
			h0 = 0;
			v = p?100/c.total:1;
			c.item.each(function(d, j) {
				h = (d.value*v - S.start) * H / S.distance;
				d.total = c.total;
				_.doParse(_, d, i + '_' + j, {
					id : i + '_' + j,
					originx : x + i * gw,
					originy : y - (h > 0 ? h : 0)-h0,
					height : Math.abs(h)
				});
				h0 += h;
				_.rectangles.push(new iChart[_.sub](_.get('sub_option'), _));
			}, _);
			_.doLabel(_, i, c.name, x - s * 0.5 + (i + 0.5) * gw, y0);
		}, _);
	},
	doConfig : function() {
		iChart.ColumnStacked2D.superclass.doConfig.call(this);
		/**
		 * start up engine
		 */
		this.engine(this);
	}
});
iChart.register('ColumnStacked2D');
/**
 *@end 
 */
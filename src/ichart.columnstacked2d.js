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
	doEngine:function(_,cw,s,S,So,H,w2,q,gw,x,y,y0){
		var h;
		iChart.each(_.columns,function(c, i) {
			h = 0;
            iChart.each(c.item,function(d, j) {
				d.total = c.total;
				h += _.rect(_,d, i + '_' + j,x + i * gw,y - h,H,S,So);
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
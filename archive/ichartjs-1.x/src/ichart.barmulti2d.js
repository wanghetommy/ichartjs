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
	doEngine:function(_,bh,s,S,So,W,h2,gw,x,y,x0){
        iChart.each(_.columns,function(c, i) {
            iChart.each(c.item,function(d, j) {
				_.rect(_,d, i + '_' + j,x,y + j * bh + i * gw,W,S,So);
			}, _);
			_.doLabel(_,i, c.name, x0, y - s * 0.5 + (i + 0.5) * gw);
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

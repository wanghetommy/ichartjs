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
	doEngine:function(_,bh,s,S,So,W,h2,gw,x,y,x0){
		iChart.each(_.data,function(d, i) {
			_.rect(_,d, i,x,y + i * gw,W,S,So);
			_.doLabel(_,i, d.name, x0, y + i * gw + h2);
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

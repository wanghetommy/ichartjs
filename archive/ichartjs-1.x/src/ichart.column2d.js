/**
 * @overview the column2d componment
 * @component#@chart#iChart.Column2D
 * @extend#iChart.Column
 */
iChart.Column2D = iChart.extend(iChart.Column, {
	/**
	 * initialize the context for the Column2D
	 */
	configure : function() {
		/**
		 * invoked the super class's configuration
		 */
		iChart.Column2D.superclass.configure.call(this);

		this.type = 'column2d';
	},
	doEngine:function(_,cw,s,S,So,H,w2,q,gw,x,y,y0){
		iChart.each(_.data,function(d, i) {
			_.rect(_,d, i,x + i * gw,y,H,S,So);
			_.doLabel(_,i, d.name, x + gw * i + w2, y0);
		}, _);
	},
	doConfig : function() {
		iChart.Column2D.superclass.doConfig.call(this);
		
		/**
		 * start up engine
		 */
		this.engine(this);
		
	}
});
iChart.register('Column2D');
/**
 *@end 
 */
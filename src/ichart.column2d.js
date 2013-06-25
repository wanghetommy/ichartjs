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
	doEngine:function(_,cw,s,S,H,w2,q,gw,x,y,y0){
		var h;
		_.data.each(function(d, i) {
			h = (d.value - S.start) * H / S.distance;
			_.doParse(_,d, i, {
				id : i,
				originx :x + i * gw,
				originy : y  - (h>0? h :0),
				height : Math.abs(h)
			});
			_.rectangles.push(new iChart[_.sub](_.get('sub_option'), _));
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
/**
 * @overview the stacked bar2d componment
 * @component#@chart#iChart.BarStacked2D
 * @extend#iChart.Bar
 */
iChart.BarStacked2D = iChart.extend(iChart.Bar, {
	/**
	 * initialize the context for the BarStacked2D
	 */
	configure : function() {
		/**
		 * invoked the super class's configuration
		 */
		iChart.BarStacked2D.superclass.configure.call(this);

		this.type = 'barstacked2d';
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
	doEngine:function(_,bh,s,S,So,W,h2,gw,x,y,x0){
		var w;
		iChart.each(_.columns,function(c, i) {
			w = 0;
			iChart.each(c.item,function(d, j) {
				d.total = c.total;
				w +=_.rect(_, d, i + '_' + j, x + w, y + i * gw, W, S, So);
			}, _);
			_.doLabel(_, i, c.name, x0, y - s * 0.5 + (i + 0.5) * gw);
		}, _);
	},
	doConfig : function() {
		iChart.BarStacked2D.superclass.doConfig.call(this);
		
		this.push('sub_option.valueAlign', this.C);
		/**
		 * start up engine
		 */
		this.engine(this);
	}
});
iChart.register('BarStacked2D');
/**
 *@end 
 */
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
	doEngine:function(_,bh,s,S,W,h2,gw,x,x0,y0){
		var w0,w,v,p = _.get('percent');
		_.columns.each(function(c, i) {
			w0 = 0;
			v = p?100/c.total:1;
			c.item.each(function(d, j) {
				w = (d.value*v - S.start) * W / S.distance;
				d.total = c.total;
				_.doParse(_, d, j, {
					id : i + '_' + j,
					originy : y0 + i * gw,
					originx : x + (w > 0 ? 0 : -Math.abs(w))+w0,
					width : Math.abs(w)
				});
				w0 += w;
				_.rectangles.push(new iChart.Rectangle2D(_.get('sub_option'), _));
			}, _);
			_.doLabel(_, i, c.name,x0, y0 - s * 0.5 + (i + 0.5) * gw);
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
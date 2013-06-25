/**
 * @overview the pie2d componment
 * @component#@chart#iChart.Pie2D
 * @extend#iChart.Pie
 */
iChart.Pie2D = iChart.extend(iChart.Pie, {
	/**
	 * initialize the context for the pie2d
	 */
	configure : function() {
		/**
		 * invoked the super class's configuration
		 */
		iChart.Pie2D.superclass.configure.call(this);

		this.type = 'pie2d';

	},
	doConfig : function() {
		iChart.Pie2D.superclass.doConfig.call(this);
		var _ = this._();
		/**
		 * quick config to all rectangle
		 */
		_.push('sub_option.radius',_.r)
		_.parse(_);
		
		
	}
});
iChart.register('Pie2D');
/**
 * @end
 */
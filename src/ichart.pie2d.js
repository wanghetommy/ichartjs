/**
 * @overview this component use for abc
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
	doSector:function(_){
		return  new iChart[_.sub](_.get('sub_option'), _);
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
/**
 * @end
 */
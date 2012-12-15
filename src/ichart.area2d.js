/**
 * @overview this component use for abc
 * @component#@chart#iChart.Area2D
 * @extend#iChart.LineBasic2D
 */
iChart.Area2D = iChart.extend(iChart.LineBasic2D, {
	/**
	 * initialize the context for the area2d
	 */
	configure : function() {
		/**
		 * invoked the super class's configuration
		 */
		iChart.Area2D.superclass.configure.call(this);

		this.type = 'area2d';

		this.set({
			/**
			 * @cfg {Float} Specifies the opacity of this area.(default to 0.3)
			 */
			area_opacity : 0.3
		});

	},
	doConfig : function() {
		/**
		 * must apply the area's config before
		 */
		this.push('sub_option.area', true);
		iChart.Area2D.superclass.doConfig.call(this);
	}
});
/**
 * @end
 */

/**
 * @overview this component will draw a cluster column3d chart.
 * @component#@chart#iChart.ColumnMulti3D
 * @extend#iChart.ColumnMulti2D
 */
iChart.ColumnMulti3D = iChart.extend(iChart.ColumnMulti2D, {
	/**
	 * initialize the context for the ColumnMulti3D
	 */
	configure : function() {
		/**
		 * invoked the super class's configuration
		 */
		iChart.ColumnMulti3D.superclass.configure.call(this);

		this.type = 'columnmulti3d';
		this.dataType = 'complex';
		this.dimension = iChart._3D;

		this.set({
			/**
			 * @cfg {Number(0~90)} Three-dimensional rotation X in degree(angle).(default to 60)
			 */
			xAngle : 60,
			/**
			 * @cfg {Number(0~90)} Three-dimensional rotation Y in degree(angle).(default to 20)
			 */
			yAngle : 20,
			/**
			 * @cfg {Number} Three-dimensional z-axis deep factor.frame of reference is width.(default to 1)
			 */
			zScale : 1,
			group_fator : 0.3,
			/**
			 * @cfg {Number(1~)} Three-dimensional z-axis deep factor of pedestal.frame of reference is width.(default to 1.4)
			 */
			bottom_scale : 1.4
		});
	},
	doConfig : function() {
		iChart.ColumnMulti3D.superclass.doConfig.call(this);

		

	}
});
/**
 * @end
 */

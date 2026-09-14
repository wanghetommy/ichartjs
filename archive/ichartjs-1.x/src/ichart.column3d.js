/**
 * @overview the column3d componment
 * @component#@chart#iChart.Column3D
 * @extend#iChart.Column2D
 */
iChart.Column3D = iChart.extend(iChart.Column2D, {
	/**
	 * initialize the context for the Column3D
	 */
	configure : function() {
		/**
		 * invoked the super class's configuration
		 */
		iChart.Column3D.superclass.configure.call(this);

		this.type = 'column3d';
		this.dimension = iChart._3D;

		this.set({
			/**
			 * @cfg {<link>iChart.Coordinate3D</link>} the option for coordinate.
			 */
			coordinate : {},
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
			/**
			 * @cfg {Number(1~)} Three-dimensional z-axis deep factor of pedestal.frame of reference is width.(default to 1.4)
			 */
			bottom_scale : 1.4
		});
	},
	doConfig : function() {
		iChart.Column3D.superclass.doConfig.call(this);
	}
});
iChart.register('Column3D');
/**
 *@end 
 */

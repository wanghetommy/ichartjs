/**
 * @overview the stacked column2d componment
 * @component#@chart#iChart.ColumnStacked3D
 * @extend#iChart.ColumnStacked2D
 */
iChart.ColumnStacked3D = iChart.extend(iChart.ColumnStacked2D, {
	/**
	 * initialize the context for the ColumnStacked2D
	 */
	configure : function() {
		/**
		 * invoked the super class's configuration
		 */
		iChart.ColumnStacked3D.superclass.configure.call(this);

		this.type = 'columnstacked3d';
		/**
		 * indicate the data structure
		 */
		this.dataType = 'stacked';
		
		this.dimension = iChart._3D;
		
		this.set({
			/**
			 * @cfg {Boolean} Specifies as true to display with percent.(default to false)
			 */
			percent : false,
			sub_option:{
				label:{color:'#ffffff'},
				valueAlign:'middle'
			},
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
		iChart.ColumnStacked3D.superclass.doConfig.call(this);
	}
});
iChart.register('ColumnStacked3D');
/**
 *@end 
 */
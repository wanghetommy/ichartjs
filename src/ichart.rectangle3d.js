	/**
	 * @overview this component use for abc
	 * @component#iChart.Rectangle3D
	 * @extend#iChart.Rectangle
	 */
	iChart.Rectangle3D = iChart.extend(iChart.Rectangle,{
		configure:function(){
			/**
			 * invoked the super class's  configuration
			 */
			iChart.Rectangle3D.superclass.configure.apply(this,arguments);
			
			/**
			 * indicate the component's type
			 */
			this.type = 'rectangle3d';
			this.dimension = iChart._3D;
			
			this.set({
				/**
				 * @cfg {Number} Specifies Three-dimensional z-axis deep in pixels.Normally,this will given by chart.(default to undefined)
				 */
				zHeight:undefined,
				/**
				 * @cfg {Number} Three-dimensional rotation X in degree(angle).socpe{0-90}.Normally,this will given by chart.(default to 60)
				 */
				xAngle:60,
				/**
				 * @cfg {Number} Three-dimensional rotation Y in degree(angle).socpe{0-90}.Normally,this will given by chart.(default to 20)
				 */
				yAngle:20,
				xAngle_:undefined,
				yAngle_:undefined,
				/**
				 * @cfg {Number} Override the default as 2
				 */
				shadow_offsetx:2
			});
			
		},
		drawRectangle:function(){
			var _ = this._();
			_.T.cube(
				_.get(_.X),
				_.get(_.Y),
				_.get('xAngle_'),
				_.get('yAngle_'),
				_.get(_.W),
				_.get(_.H),
				_.get('zHeight'),
				_.get('f_color'),
				_.get('border.enable'),
				_.get('border.width'),
				_.get('light_color'),
				_.get('shadow')
			);
		},
		isEventValid:function(e,_){
			return {valid:e.x>_.x&&e.x<(_.x+_.get(_.W))&&e.y<_.y+_.get(_.H)&&e.y>_.y};
		},
		tipInvoke:function(){
			var _ = this._();
			return function(w,h){
				return {
					left:_.topCenterX - w/2,
					top:_.topCenterY - h
				}
			}
		},
		doConfig:function(){
			iChart.Rectangle3D.superclass.doConfig.call(this);
			var _ = this._();
			_.pushIf("zHeight",_.get(_.W));
			
			_.topCenterX=_.x+(_.get(_.W)+_.get(_.W)*_.get('xAngle_'))/2;
			_.topCenterY=_.y-_.get(_.W)*_.get('yAngle_')/2;
			
			if(_.get('valueAlign')==_.O&&_.label){
				_.label.push('textx',_.topCenterX);
				_.label.push('texty',_.topCenterY);
			}
			
		}
});
/**
 *@end
 */	
	/**
	 * @overview the rectangle2d componment
	 * @component#iChart.Rectangle2D
	 * @extend#iChart.Rectangle
	 */
	iChart.Rectangle2D = iChart.extend(iChart.Rectangle,{
		configure:function(){
			/**
			 * invoked the super class's  configuration
			 */
			iChart.Rectangle2D.superclass.configure.apply(this,arguments);
			
			/**
			 * indicate the component's type
			 */
			this.type = 'rectangle2d';
			
			this.set({
				/**
				 * @cfg {Number} Override the default as -2
				 */
				shadow_offsety:-2
			});
			
		},
		drawRectangle:function(){
			var _ = this._();
			_.T.box(
				_.get(_.X),
				_.get(_.Y),
				_.get(_.W),
				_.get(_.H),
				_.get('border'),
				_.get('f_color'),
				_.get('shadow'));
		},
		isEventValid:function(e,_){
			return {valid:e.x>_.x&&e.x<(_.x+_.width)&&e.y<(_.y+_.height)&&e.y>(_.y)};
		},
		tipInvoke:function(){
			var _ = this._();
			/**
			 * base on event?
			 */
			return function(w,h){
				return {
					left:_.tipX(w,h),
					top:_.tipY(w,h)
				}
			}
		},
		doConfig:function(){
			iChart.Rectangle2D.superclass.doConfig.call(this);
			var _ = this._(),tipAlign = _.get('tipAlign');
			if(tipAlign==_.L||tipAlign==_.R){
				_.tipY = function(w,h){return _.get('centery') - h/2;};
			}else{
				_.tipX = function(w,h){return _.get('centerx') -w/2;};
			}
			
			if(tipAlign==_.L){
				_.tipX = function(w,h){return _.x - _.get('value_space') -w;};
			}else if(tipAlign==_.R){
				_.tipX = function(w,h){return _.x + _.width + _.get('value_space');};
			}else if(tipAlign==_.B){
				_.tipY = function(w,h){return _.y  +_.height+3;};
			}else{
				_.tipY = function(w,h){return _.y  - h -3;};
			}
			
			_.applyGradient();
			
			
		}
});
/**
 *@end
 */	
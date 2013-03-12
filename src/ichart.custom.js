	/**
	 * @overview the customize componment
	 * @component#iChart.Custom
	 * @extend#iChart.Component
	 */
	iChart.Custom = iChart.extend(iChart.Component,{
		configure:function(){
			/**
			 * invoked the super class's  configuration
			 */
			iChart.Custom.superclass.configure.apply(this,arguments);
			
			/**
			 * indicate the component's type
			 */
			this.type = 'custom';
			
			this.set({
				/**
				 * @cfg {Function} Specifies the customize function.(default to emptyFn)
				 */
				drawFn:iChart.emptyFn,
				configFn:iChart.emptyFn,
				/**
				 * @cfg {Function} Specifies the customize event valid function.(default to undefined)
				 */
				eventValid:undefined,
				/**
				 * @cfg {Boolean} If true when chart animating it also invoke darw.(default to true)
				 */
				animating_draw:true
			});
		},
		doDraw:function(_){
			_.get('drawFn').call(_,_);
		},
		isEventValid:function(e,_){
			if(iChart.isFunction(this.get('eventValid')))
			return this.get('eventValid').call(this,e,_);
			return {valid:false};
		},
		doConfig:function(){
			iChart.Custom.superclass.doConfig.call(this);
			var _ = this._();
			_.A_draw = _.get('animating_draw');
			_.variable.animation = {
				animating:false,	
				time : 0
			};
			_.duration = 0;
			_.get('configFn').call(_,_);
		}
});
/**
 * @end
 */
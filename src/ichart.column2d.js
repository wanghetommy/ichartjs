/**
 * @overview the column2d componment
 * @component#@chart#iChart.Column2D
 * @extend#iChart.Column
 */
iChart.Column2D = iChart.extend(iChart.Column, {
	/**
	 * initialize the context for the Column2D
	 */
	configure : function() {
		/**
		 * invoked the super class's configuration
		 */
		iChart.Column2D.superclass.configure.call(this);

		this.type = 'column2d';
		
	},
	doConfig : function() {
		iChart.Column2D.superclass.doConfig.call(this);
		/**
		 * get the max/min scale of this coordinate for calculated the height
		 */
		var _ = this._(),
			c = _.get('colwidth'),
			s = _.get('hispace'),
			S = _.coo.getScale(_.get('scaleAlign')),
			H = _.coo.get(_.H), 
			h2 = c / 2, 
			gw = c + s, 
			h,
			y0 = _.coo.get(_.Y) +  H,
			y = y0 - S.basic*H - (_.is3D()?(_.get('zHeight') * (_.get('bottom_scale') - 1) / 2 * _.get('yAngle_')):0),
			x = s+_.coo.get('x_start');
			y0 = y0 + _.get('text_space') + _.coo.get('axis.width')[2];
		_.data.each(function(d, i) {
			h = (d.value - S.start) * H / S.distance;
			_.doParse(_,d, i, {
				id : i,
				originx :x + i * gw,
				originy : y  - (h>0? h :0),
				height : Math.abs(h)
			});
			_.rectangles.push(new iChart[_.sub](_.get('sub_option'), _));
			_.doLabel(_,i, d.name, x + gw * i + h2, y0);
		}, _);
	}
});
/**
 *@end 
 */
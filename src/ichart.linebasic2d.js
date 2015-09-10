/**
 * @overview this component will draw a line2d chart.
 * @component#@chart#iChart.LineBasic2D
 * @extend#iChart.Line
 */
iChart.LineBasic2D = iChart.extend(iChart.Line, {
	/**
	 * initialize the context for the LineBasic2D
	 */
	configure : function() {
		/**
		 * invoked the super class's configuration
		 */
		iChart.LineBasic2D.superclass.configure.call(this);

		this.type = 'basicline2d';

		this.tipInvokeHeap = [];
	},
	doAnimation : function(t, d,_) {
		iChart.each(_.lines,function(l){
			iChart.each(l.get('points'),function(p){
				p.y = l.y - Math.ceil(_.animationArithmetic(t, 0, l.y - p.y_, d));
			});
			l.drawSegment();
		});
	},
	doConfig : function() {
		iChart.LineBasic2D.superclass.doConfig.call(this);
		var _ = this._();
		if(_.isE())return;
		/**
		 * get the max/min scale of this coordinate for calculated the height
		 */
		var S, H = _.coo.valid_height, sp = _.get('point_space'), points, x, y, 
		ox = _.get('sub_option.originx'), oy, p,N=_.get('nullToDirect');
		
		_.push('sub_option.tip.showType', 'follow');
		_.push('sub_option.coordinate', _.coo);
		_.push('sub_option.tipInvokeHeap', _.tipInvokeHeap);
		_.push('sub_option.point_space', sp);


		iChart.each(_.data,function(d, i){
			S = _.coo.getScale(d.scaleAlign||_.get('scaleAlign'));
			oy = _.get('sub_option.originy')- S.basic*H;
			points = [];
			var V = S.values;

			iChart.each(d.value,function(v, j){
                if(v!=null){
                    x = sp * j;
					//TODO move to scale
					for(var i=1;i< V.length;i++){
						if(v<=V[i]){
							y = ((((v - V[i-1])/(V[i]-V[i-1])+(i-1)))/(V.length-1)) * H;
							//console.log(v,v - V[i-1],V[i]-V[i-1],i,y,H);
							break;
						}
					}

                    //y = (v - S.start) * H /S.distance;
                    p = {
                        x : ox + x,
                        y : oy - y,
                        value : v,
                        text : d.name+' '+v
                    };
                    iChart.merge(p, _.fireEvent(_, 'parsePoint', [d, v, x, y, j,S]));
                    points.push(p);
                }else{
                    points.push({ignored:!N,direct:N});
                }
			}, _);
			/**
			 * merge the option
			 */
			iChart.merge(_.get('sub_option'),d);
			
			_.push('sub_option.points', points);
			_.push('sub_option.brushsize', d.linewidth || d.line_width);
			_.lines.push(new iChart.LineSegment(_.get('sub_option'), _));
		}, this);
	}
});
iChart.register('LineBasic2D');
/**
 * @end
 */

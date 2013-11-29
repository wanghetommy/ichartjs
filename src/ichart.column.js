/**
 * @overview this class is abstract,use for config column
 * @component#iChart.Column
 * @extend#iChart.Chart
 */
iChart.Column = iChart.extend(iChart.Chart, {
	/**
	 * initialize the context for the Column
	 */
	configure : function(config) {
		/**
		 * invoked the super class's configuration
		 */
		iChart.Column.superclass.configure.call(this);

		this.type = 'column';
		
		this.set({
			/**
			 * @cfg {<link>iChart.Coordinate2D</link>} the option for coordinate.
			 */
			coordinate : {},
			/**
			 * @cfg {Number} By default,if a width is not specified the chart will attempt to distribution in horizontally.(default to '80%')
			 */
			column_width : '66%',
			/**
			 * @cfg {Number} the space of each column.this option is readOnly.(default to undefined)
			 */
			column_space : undefined,
			/**
			 * @cfg {Number} the distance of column's bottom and text(default to 6)
			 */
			text_space : 6,
			/**
			 * @cfg {String} the align of scale(default to 'left') Available value are:
			 * @Option 'left'
			 * @Option 'right'
			 */
			scaleAlign : 'left',
			/**
			 * @cfg {<link>iChart.Rectangle</link>} Specifies option of rectangle.
			 */
			sub_option : {},
			/**
			 * @cfg {<link>iChart.Text</link>} Specifies option of label at bottom.
			 */
			label:{}
		});

		this.registerEvent();
		this.rectangles = [];
		this.labels = [];
		this.components.push(this.labels);
		this.components.push(this.rectangles);
	},
	doAnimation : function(t, d,_) {
		var h;
		_.labels.each(function(l){
			l.draw();
		});
		_.rectangles.each(function(r){
			h = Math.ceil(_.animationArithmetic(t, 0, r.height, d));
			r.push(_.Y, r.y + (r.height - h));
			r.push(_.H, h);
			r.drawRectangle();
		});
	},
	/**
	 * @method Returns the coordinate of this element.
	 * @return iChart.Coordinate2D
	 */
	getCoordinate:function(){
		return this.coo;
	},
	doLabel:function(_,id,text,x, y){
		_.labels.push(new iChart.Text(iChart.apply(_.get('label'),{
			id : id,
			text : text,
			originx : x,
			originy : y
		}), _));
	},
	doParse : function(_,d, i, o) {
		_.doActing(_,d,o,i);
	},
	engine:function(_){
		if(_.isE())return;
		var cw = _.get('column_width_'),
		s = _.get('column_space'),
		S = _.coo.getScale(_.get('scaleAlign')),
		H = _.coo.valid_height, 
		w2 = cw / 2, 
		q = cw * (_.get('group_fator') || 0), 
		gw = _.dataType != 'complex'?(cw + s):(_.data.length * cw + s + (_.is3D() ? (_.data.length - 1) * q : 0)), 
		y0 = _.coo.get('y_end'),
		y = y0 - S.basic*H - (_.is3D()?(_.get('zHeight') * (_.get('bottom_scale') - 1) / 2 * _.get('yAngle_')):0),
		x = s+_.coo.get('x_start');
		y0 = y0 + _.get('text_space') + _.coo.get('axis.width')[2];
		/**
		 * applies paramters to subClass
		 */
		_.doEngine(_,cw,s,S,H,w2,q,gw,x,y,y0);
	},
	doConfig : function() {
		iChart.Column.superclass.doConfig.call(this);
		
		var _ = this._(),c = 'column_width',z = 'z_index';
		_.sub = _.is3D()?'Rectangle3D':'Rectangle2D';
		_.rectangles.length = 0;
		_.labels.length = 0;
		_.rectangles.zIndex = _.get(z);
		_.labels.zIndex = _.get(z) + 1;
		
		/**
		 * use option create a coordinate
		 */
		_.coo = iChart.Coordinate.coordinate_.call(_,function(){
			var L = _.data.length, W = _.get('coordinate.valid_width_value'),w_,KL;
			if (_.dataType == 'complex') {
				KL = _.get('labels').length;
				L = KL * L + (_.is3D()?(L-1)*KL*_.get('group_fator'):0);
				KL +=1;
			}else{
				if(_.dataType == 'stacked'){
					L = _.get('labels').length;
				}
				KL = L+1;
			}
			
			/**
			 * the space of two column
			 */
			_.push('column_space', (W - _.push('sub_option.width',_.push('column_width_',iChart.parsePercent(_.get(c),Math.floor(W/L)))) * L) / KL);
			
			if (_.is3D()) {
				_.push('sub_option.zHeight', _.push('zHeight', _.get('column_width_') * _.get('zScale')));
				_.push('sub_option.xAngle_', _.get('xAngle_'));
				_.push('sub_option.yAngle_', _.get('yAngle_'));
			}
		});
	}

});
/**
 * @end
 */
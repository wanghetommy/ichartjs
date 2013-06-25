/**
 * @overview this class is abstract,use for config line
 * @component#iChart.Line
 * @extend#iChart.Chart
 */
iChart.Line = iChart.extend(iChart.Chart, {
	/**
	 * initialize the context for the line
	 */
	configure : function() {
		/**
		 * invoked the super class's configuration
		 */
		iChart.Line.superclass.configure.call(this);

		this.type = 'line';

		this.set({
			/**
			 * @cfg {Number} Specifies the default linewidth of the canvas's context in this element.(defaults to 1)
			 */
			brushsize : 1,
			/**
			 * @cfg {Object} the option for coordinate
			 */
			coordinate : {
				axis : {
					width : [0, 0, 2, 2]
				}
			},
			/**
			 * @cfg {Object} Specifies config crosshair.(default enable to false).For details see <link>iChart.CrossHair</link> Note:this has a extra property named 'enable',indicate whether crosshair available(default to false)
			 */
			crosshair : {
				enable : false
			},
			/**
			 * @cfg {Function} when there has more than one linesegment,you can use tipMocker make them as a tip.(default to null)
			 * @paramter Array tips the array of linesegment's tip
			 * @paramter int the index of data
			 * @return String
			 */
			tipMocker:null,
			/**
			 * @cfg {Number(0.0~1.0)} If null,the position there will follow the points.If given a number,there has a fixed postion,0 is top,and 1 to bottom.(default to null)
			 */
			tipMockerOffset:null,
			/**
			 * @cfg {String} the align of scale.(default to 'left') Available value are:
			 * @Option 'left'
			 * @Option 'right'
			 */
			scaleAlign : 'left',
			/**
			 * @cfg {String} the align of label.(default to 'bottom') Available value are:
			 * @Option 'top,'bottom'
			 */
			labelAlign : 'bottom',
			/**
			 * @cfg {Array} the array of labels close to the axis
			 */
			labels : [],
			/**
			 * @inner {Number} the distance of column's bottom and text.(default to 6)
			 */
			label_space : 6,
			/**
			 * @inner {Boolean} if the point are proportional space.(default to true)
			 */
			proportional_spacing : true,
			/**
			 * @cfg {<link>iChart.LineSegment</link>} the option for linesegment.
			 */
			sub_option : {},
			/**
			 * {Object} the option for legend.
			 */
			legend : {
				sign : 'bar'
			},
			/**
			 * @cfg {<link>iChart.Text</link>} Specifies option of label at bottom.
			 */
			label:{}
		});

		this.registerEvent(
		/**
		 * @event Fires when parse this element'data.Return value will override existing.
		 * @paramter object#data the data of one linesegment
		 * @paramter object#v the point's value
		 * @paramter int#x coordinate-x of point
		 * @paramter int#y coordinate-y of point
		 * @paramter int#index the index of point
		 * @return Object object Detail:
		 * @property text the text of point
		 * @property x coordinate-x of point
		 * @property y coordinate-y of point
		 */
		'parsePoint');

		this.lines = [];
		this.components.push(this.lines);
	},
	/**
	 * @method Returns the coordinate of this element.
	 * @return iChart.Coordinate2D
	 */
	getCoordinate : function() {
		return this.coo;
	},
	doConfig : function() {
		iChart.Line.superclass.doConfig.call(this);
		var _ = this._(), s = _.data.length == 1;
		
		_.lines.length = 0;
		_.lines.zIndex = _.get('z_index');
		
		var k = _.pushIf('sub_option.keep_with_coordinate',s);
		if (_.get('crosshair.enable')) {
			_.pushIf('crosshair.hcross', s);
			_.push('crosshair.invokeOffset', function(e, m) {
				/**
				 * TODO how fire muti line?now fire by first line
				 */
				var r = _.lines[0].isEventValid(e);
				return r.valid ? r : k;
			});
		}
		
		if(!_.Combination){
			_.push('coordinate.crosshair', _.get('crosshair'));
			_.pushIf('coordinate.scale',[{
				position : _.get('scaleAlign'),
				max_scale : _.get('maxValue')
			}, {
				position : _.get('labelAlign'),
				start_scale : 1,
				scale : 1,
				end_scale : _.get('maxItemSize'),
				labels : _.get('labels'),
				label:_.get('label')
			}]);
		}
		
		/**
		 * use option create a coordinate
		 */
		_.coo = iChart.Coordinate.coordinate_.call(_);
		
		if(_.Combination){
			_.coo.push('crosshair', _.get('crosshair'));
			_.coo.doCrosshair(_.coo);
		}
		
		var vw = _.coo.valid_width,nw=vw,size=_.get('maxItemSize') - 1,M=vw / (size),ps=_.get('point_space');
		
		if (_.get('proportional_spacing')){
			if(ps&&ps<M){
				nw = size*ps;
			}else{
				_.push('point_space',M);
			}
		}
		
		_.push('sub_option.width', nw);
		_.push('sub_option.height', _.coo.valid_height);
		
		_.push('sub_option.originx', _.coo.get('x_start')+(vw-nw)/2);
		_.push('sub_option.originy', _.coo.get('y_end'));
		
		if (_.get('tip.enable')){
			if(!_.mocker&&iChart.isFunction(_.get('tipMocker'))){
				_.push('sub_option.tip.enable', false);
				_.push('tip.invokeOffsetDynamic', true);
				var U,x=_.coo.get(_.X),y=_.coo.get(_.Y),H=_.coo.height,f = _.get('tipMockerOffset'),r0,r,r1;
				f = iChart.isNumber(f)?(f<0?0:(f>1?1:f)):null;
				_.push('tip.invokeOffset',function(w,h,m){
					if(f!=null){
						m.top = y+(H-h)*f;
					}else{
						m.top = m.maxTop-(m.maxTop-m.minTop)/3-h;
						if(h>H||y>m.top){
							m.top = y;
						}
					}
					return {
						left:(m.left - w - x  > 5)?m.left-w-5:m.left+5,
						top:m.top
					}
				});
				/**
				 * proxy the event parseText
				 */
				var p = _.get('tip.listeners.parseText');
				if(p)
				delete _.get('tip.listeners').parseText;
				_.mocker = new iChart.Custom({
					eventValid:function(e){
						r = _.lines[0].isEventValid(e);
						r.hit = r0 != r.i;
						if(r.valid){
							r0 = r.i;
							U = [];
							_.lines.each(function(l,i){
								r1 = l.isEventValid(e);
								if(i==0){
									r.minTop = r.maxTop = r1.top;
								}else{
									r.minTop = Math.min(r.minTop,r1.top);
									r.maxTop = Math.max(r.maxTop,r1.top);
								}
								U.push(p?p(null,r1.name,r1.value,r1.text,r1.i):(r1.name+' '+r1.value));
							});
							r.text = _.get('tipMocker').call(_,U,r.i)||'tipMocker not return';
						}
						return r.valid ? r : false;
					}
				});
				new iChart.Tip(_.get('tip'),_.mocker);
				_.register(_.mocker);
			}
		}
		_.pushIf('sub_option.area_opacity',_.get('area_opacity'));
	}

});
/**
 * @end
 */

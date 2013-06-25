	/**
	 * @overview the text componment
	 * @component#iChart.Text
	 * @extend#iChart.Component
	 */
	iChart.Text = iChart.extend(iChart.Component,{
		configure:function(){
			/**
			 * invoked the super class's  configuration
			 */
			iChart.Text.superclass.configure.apply(this,arguments);
			
			/**
			 * indicate the component's type
			 */
			this.type = 'text';
			
			this.set({
				/**
				 * @cfg {String} Specifies the text want to disply.(default to '')
				 */
				text:'',
				/**
				 * @cfg {String} there has two layers of meaning,when width is 0,Specifies the textAlign of html5.else this is the alignment of box.(default to 'center')
				 * when width is 0,Available value are:
				 * @Option start
				 * @Option end
				 * @Option left
				 * @Option right
				 * @Option center
				 * when width is not 0,Available value are:
				 * @Option left
				 * @Option right
				 * @Option center
				 */
				textAlign:'center',
				/**
				 * @cfg {String} Specifies the alignment in box.(default to 'center')
				 * @Option left
				 * @Option right
				 * @Option center
				 */
				align:'center',
				/**
				 * @cfg {String} Here,specify as false to make background transparent.(default to null)
				 */
				background_color : 0,
				/**
				 * @cfg {String} Specifies the textBaseline of html5.(default to 'top')
				 * Available value are:
				 * @Option top
				 * @Option hanging
				 * @Option middle
				 * @Option alphabetic
				 * @Option ideographic
				 * @Option bottom
				 */
				textBaseline:'top',
				/**
				 * @cfg {Object} Here,specify as false by default
				 * @see <link>iChart.Element#border</link>
				 */
				border : {
					enable : false
				},
				/**
				 * @cfg {Number} Specifies the maxwidth of text in pixels,if given 0 will not be limited.(default to 0)
				 */
				width:0,
				/**
				 * @cfg {Number} Specifies the maxheight of text in pixels,if given 0 will not be limited(default to 0)
				 */
				height:0,
				/**
				 * @cfg {Number} Here,specify as 0 by default
				 */
				padding:0,
				/**
				 * @cfg {String} Specifies the writing-mode of text.(default to 'lr') .
				 * Available value are:
				 * @Option 'lr'
				 */
				writingmode : 'lr',
				/**
				 * @cfg {Number} Specifies the lineheight when text display multiline.(default to 16).
				 */
				line_height : 16,
				/**
				 * @cfg {Number} Specifies the angle that text writed.0 to horizontal,clockwise.(default to 0).
				 */
				rotate:0
			});
			
			this.registerEvent();
			
		},
		doDraw:function(_){
			if(_.get('box_feature'))
			_.T.box(_.x,_.y,_.get(_.W),_.get(_.H),_.get('border'),_.get('f_color'));
			_.T.text(_.get('text'),_.get('textx'),_.get('texty'),_.get(_.W)-_.get('hpadding'),_.get('color'),_.get('textAlign'),_.get('textBaseline'),_.get('fontStyle'),_.get('writingmode'),_.get('line_height'),_.get('shadow'),_.get('rotate'));
		},
		isEventValid:function(){
			return {valid:false};
		},
		doLayout:function(x,y,n,_){
			_.x = _.push(_.X,_.x+x);
			_.y = _.push(_.Y,_.y+y);
			_.push('textx',_.get('textx')+x);
			_.push('texty',_.get('texty')+y);
		},
		doConfig:function(){
			iChart.Text.superclass.doConfig.call(this);
			var _ = this._(),x = _.x,y=_.y+_.get('padding_top'),w=_.get(_.W),h=_.get(_.H),a=_.get('textAlign');
			x+=(a==_.C?w/2:(a==_.R?w-_.get('padding_right'):_.get('padding_left')));
			if(h){
				y+=h/2;
				_.push('textBaseline','middle');
			}
			_.push('textx',x);
			_.push('texty',y);
			_.push('box_feature',w&&h);
			_.applyGradient();
		}
});
/**
 * @end
 */
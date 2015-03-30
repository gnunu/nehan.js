var TextGenerator = (function(){
  /**
     @memberof Nehan
     @class TextGenerator
     @classdesc inline level generator, output inline level block.
     @constructor
     @extends {Nehan.LayoutGenerator}
     @param style {Nehan.StyleContext}
     @param stream {Nehan.TokenStream}
     @param child_generator {Nehan.LayoutGenerator}
  */
  function TextGenerator(style, stream){
    LayoutGenerator.call(this, style, stream);
  }
  Class.extend(TextGenerator, LayoutGenerator);

  var __find_head_text = function(element){
    return (element instanceof Box)? __find_head_text(element.elements[0]) : element;
  };

  TextGenerator.prototype._yield = function(context){
    if(!context.hasInlineSpaceFor(1)){
      return null;
    }
    var font_size = this.style.getFontSize();
    while(this.hasNext()){
      var element = this._getNext(context);
      //console.log("element:%o", (element? (element.data || "?") : "null"));
      if(element === null){
	break;
      }
      var measure = this._getMeasure(element);
      //console.log("[%s]element:%s, m = %d (%d/%d)", this.style.markupName, (element.data || ""), measure, context.inline.curMeasure, context.inline.maxMeasure);
      if(measure === 0){
	break;
      }
      // if token is last one and maybe tail text, check tail/head NG between two inline generators.
      if(!this.stream.hasNext() && !context.hasInlineSpaceFor(measure + font_size)){
	// avoid tail NG between two generators
	if(element instanceof Char && element.isTailNg()){
	  this.pushCache(element);
	  break;
	}
	// avoid head NG between two generators
	var head = this._peekParentNextToken();
	if(head && (head instanceof Text || head instanceof Tag)){
	  var head_c1 = head.getContent().substring(0,1); // both Text and Tag have same method 'getContent'
	  var head_char = new Char(head_c1);
	  if(head_char.isHeadNg()){
	    this.pushCache(element);
	    break;
	  }
	}
      }
      if(!context.hasInlineSpaceFor(measure)){
	//console.log("!> text overflow:%o(m=%d)", element, measure);
	this.pushCache(element);
	break;
      }
      this._addElement(context, element, measure);
      //console.log("cur measure:%d", context.inline.curMeasure);
      if(!context.hasInlineSpaceFor(1)){
	break;
      }
    }
    return this._createOutput(context);
  };

  TextGenerator.prototype._createChildContext = function(context){
    return new CursorContext(
      context.block, // inline generator inherits block context as it is.
      new InlineContext(context.getInlineRestMeasure())
    );
  };

  TextGenerator.prototype._createOutput = function(context){
    if(context.isInlineEmpty()){
      return null;
    }
    // justify if this line is generated by overflow(not line-break).
    if(Config.justify && !context.isInlineEmpty() && !context.hasLineBreak()){
      this._justifyLine(context);
    }
    var line = this.style.createTextBlock({
      lineBreak:context.hasLineBreak(), // is line break included in?
      breakAfter:context.hasBreakAfter(), // is break after included in?
      measure:context.getInlineCurMeasure(), // actual measure
      elements:context.getInlineElements(), // all inline-child, not only text, but recursive child box.
      charCount:context.getInlineCharCount(),
      maxExtent:context.getInlineMaxExtent(),
      maxFontSize:context.getInlineMaxFontSize(),
      isEmpty:context.isInlineEmpty()
    });

    // set position in parent stream.
    if(this._parent && this._parent.stream){
      line.pos = Math.max(0, this._parent.stream.getPos() - 1);
    }

    // call _onCreate callback for 'each' output
    this._onCreate(context, line);

    // call _onComplete callback for 'final' output
    if(!this.hasNext()){
      this._onComplete(context, line);
    }
    //console.log(">> texts:[%s], context = %o, stream pos:%d, stream:%o", line.toString(), context, this.stream.getPos(), this.stream);
    return line;
  };

  TextGenerator.prototype._peekParentNextToken = function(){
    var root_line = this._parent;
    while(root_line && root_line instanceof InlineGenerator){
      root_line = root_line._parent;
    }
    root_line = root_line || this._parent;
    return root_line? (root_line.stream? root_line.stream.peek() : null) : null;
  };

  TextGenerator.prototype._justifyLine = function(context){
    // before justify, skip single <br> to avoid double line-break.
    var stream_next = this.stream? this.stream.peek() : null;
    if(stream_next && Token.isTag(stream_next) && stream_next.getName() === "br"){
      this.stream.get(); // skip <br>
    }
    // by stream.getToken(), stream pos has been moved to next pos already, so cur pos is the next head.
    var next_head = this.peekLastCache() || this.stream.peek();
    var new_head = context.justify(next_head); // if justify is occured, new_tail token is gained.
    if(new_head){
      this.stream.setPos(new_head.pos);
      this.clearCache(); // stream position changed, so disable cache.
    }
  };

  TextGenerator.prototype._getNext = function(context){
    if(this.hasCache()){
      var cache = this.popCache(context);
      return cache;
    }

    // read next token
    var token = this.stream.get();
    if(token === null){
      return null;
    }

    //console.log("text token:%o", token);

    // if white-space
    if(Token.isWhiteSpace(token)){
      return this._getWhiteSpace(context, token);
    }

    // if tcy, wrap all content and return Tcy object and force generator terminate.
    if(this.style.getTextCombine() === "horizontal"){
      return this._getTcy(context, token);
    }
    return this._getText(context, token);
  };

  TextGenerator.prototype._breakInline = function(block_gen){
    this.setTerminate(true);
    if(this._parent === null){
      return;
    }
    if(this._parent instanceof TextGenerator){
      this._parent._breakInline(block_gen);
    } else {
      this._parent.setChildLayout(block_gen);
    }
  };

  TextGenerator.prototype._getTcy = function(context, token){
    this.setTerminate(true);
    var tcy = new Tcy(this.style.getMarkupContent());
    return this._getText(context, tcy);
  };

  TextGenerator.prototype._getWhiteSpace = function(context, token){
    if(this.style.isPre()){
      return this._getText(context, token); // read as normal text
    }
    // if not pre, skip continuous white-spaces.
    //this.stream.skipUntil(Token.isNewLine);

    if(Token.isNewLine(token)){
      // skip continuous white-spaces.
      this.stream.skipUntil(Token.isNewLine);
      return this._getNext(context);
    }
    // if white-space is not new-line, use first one.
    return this._getText(context, token);
  };

  TextGenerator.prototype._getText = function(context, token){
    if(!token.hasMetrics()){
      this._setTextMetrics(context, token);
    }
    switch(token._type){
    case "char":
    case "tcy":
    case "ruby":
      return token;
    case "word":
      return this._getWord(context, token);
    }
  };

  TextGenerator.prototype._setTextMetrics = function(context, token){
    // if charactor token, set kerning before setting metrics.
    // because some additional space is added if kerning is enabled or not.
    if(token instanceof Char && Config.kerning){
      this._setCharKerning(context, token);
    }
    token.setMetrics(this.style.flow, this.style.font);
  };

  TextGenerator.prototype._setCharKerning = function(context, char_token){
    var next_token = this.stream.peek();
    var prev_text = context.getInlineLastElement();
    var next_text = next_token && Token.isText(next_token)? next_token : null;
    Kerning.set(char_token, prev_text, next_text);
  };

  TextGenerator.prototype._getWord = function(context, token){
    var rest_measure = context.getInlineRestMeasure();
    var advance = token.getAdvance(this.style.flow, this.style.letterSpacing || 0);
    
    // if there is enough space for this word, just return.
    if(advance <= rest_measure){
      token.setDivided(false);
      return token;
    }
    // at this point, this word is larger than rest space.
    // but if this word size is less than max_measure and 'word-berak' is not 'break-all',
    // just break line and show it at the head of next line.
    if(advance <= context.getInlineMaxMeasure() && !this.style.isWordBreakAll()){
      return token; // overflow and cached
    }
    // at this point, situations are
    // 1. advance is larger than rest_measure and 'word-break' is set to 'break-all'.
    // 2. or word itself is larger than max_measure.
    // in these case, we must cut this word into some parts.
    var part = token.cutMeasure(this.style.getFontSize(), rest_measure); // get sliced word
    part.setMetrics(this.style.flow, this.style.font); // metrics for first half
    token.setMetrics(this.style.flow, this.style.font); // metrics for second half
    if(token.data !== "" && token.bodySize > 0){
      this.stream.prev(); // re-parse this token because rest part is still exists.
    }
    part.bodySize = Math.min(rest_measure, part.bodySize); // sometimes overflows. more accurate logic is required in the future.
    return part;
  };

  TextGenerator.prototype._getMeasure = function(element){
    return element.getAdvance(this.style.flow, this.style.letterSpacing || 0);
  };

  TextGenerator.prototype._addElement = function(context, element, measure){
    context.addInlineTextElement(element, measure);

    // call _onAddElement callback for each 'element' of output.
    this._onAddElement(context, element);
  };

  return TextGenerator;
})();


Args.copy(Layout, __engine_args.layout || {});
Args.copy(Config, __engine_args.config || {});

// export global interfaces
Nehan.version = "5.0.0";
Nehan.Class = Class;
Nehan.Env = Env;

// export engine local interfaces
return {
  documentContext: DocumentContext,
  createPageStream : function(text, group_size){
    group_size = Math.max(1, group_size || 1);
    return (group_size === 1)? new PageStream(text, 1) : new PageGroupStream(text, group_size);
  },
  setStyle : function(selector_key, value){
    Selectors.setValue(selector_key, value);
    return this;
  },
  setStyles : function(values){
    for(var selector_key in values){
      Selectors.setValue(selector_key, values[selector_key]);
    }
    return this;
  }
};

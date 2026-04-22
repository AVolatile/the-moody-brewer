(function(global) {
  'use strict';

  var MAX_IMAGE_BYTES = 2 * 1024 * 1024;
  var ABSOLUTE_URL_PATTERN = /^https?:\/\/\S+$/i;
  var ROOT_PATH_PATTERN = /^\/\S+$/;
  var RELATIVE_PATH_PATTERN = /^(?:\.{1,2}\/|assets\/|img\/)\S+$/i;
  var IMAGE_FILE_PATTERN = /\.(?:avif|gif|jpe?g|png|svg|webp)(?:[?#].*)?$/i;
  var DATA_IMAGE_PATTERN = /^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+$/i;
  var DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
  var IMAGE_PLACEHOLDER_PATTERN = /^placeholder:(drink|food)$/i;

  function isBlank(value) {
    return value == null || (typeof value === 'string' && value.trim() === '');
  }

  function normalizeText(value) {
    return value == null ? '' : String(value).trim();
  }

  function sanitizeValues(values) {
    var sanitized = {};

    Object.keys(values || {}).forEach(function(fieldName) {
      var value = values[fieldName];
      sanitized[fieldName] = typeof value === 'string' ? value.trim() : value;
    });

    return sanitized;
  }

  function addError(errors, fieldName, message) {
    if (!fieldName || !message) return;
    if (!errors[fieldName]) {
      errors[fieldName] = [];
    }
    if (errors[fieldName].indexOf(message) === -1) {
      errors[fieldName].push(message);
    }
  }

  function extend(target, source) {
    var output = target || {};

    Object.keys(source || {}).forEach(function(key) {
      output[key] = source[key];
    });

    return output;
  }

  function isValidNumber(value) {
    var numericValue = Number(value);
    return typeof numericValue === 'number' && isFinite(numericValue);
  }

  function isValidInteger(value) {
    var numericValue = Number(value);
    return isValidNumber(numericValue) && numericValue === Math.floor(numericValue);
  }

  function isValidImageReference(value) {
    var imageValue = normalizeText(value);
    if (!imageValue || /^javascript:/i.test(imageValue)) return false;

    return (
      IMAGE_PLACEHOLDER_PATTERN.test(imageValue) ||
      DATA_IMAGE_PATTERN.test(imageValue) ||
      ABSOLUTE_URL_PATTERN.test(imageValue) ||
      ROOT_PATH_PATTERN.test(imageValue) ||
      RELATIVE_PATH_PATTERN.test(imageValue) ||
      IMAGE_FILE_PATTERN.test(imageValue)
    );
  }

  function normalizePlaceholderKey(value) {
    var normalized = normalizeText(value).toLowerCase();

    if (!normalized) return '';
    if (normalized.indexOf('placeholder:') === 0) {
      normalized = normalized.slice('placeholder:'.length);
    }

    return normalized;
  }

  function isValidPlaceholderKey(value) {
    var placeholderKey = normalizePlaceholderKey(value);
    return placeholderKey === 'drink' || placeholderKey === 'food';
  }

  function getUploadImageError(context) {
    var uploadFile = context && context.uploadFile ? context.uploadFile : null;
    var uploadData = context && context.uploadData ? context.uploadData : null;

    if (context && context.uploadPending) {
      return 'Image is still loading. Please wait a moment.';
    }
    if (uploadFile) {
      if (uploadFile.type && !/^image\//i.test(uploadFile.type)) {
        return 'Please provide a valid image.';
      }
      if (uploadFile.size > MAX_IMAGE_BYTES) {
        return 'Image must be 2MB or smaller.';
      }
    }
    if (uploadData && !DATA_IMAGE_PATTERN.test(String(uploadData))) {
      return 'Please provide a valid image.';
    }
    return null;
  }

  function textRules(messages, options) {
    var settings = extend({
      required: false,
      minLength: 0,
      maxLength: null,
      when: null
    }, options || {});
    var rules = [];

    if (settings.required) {
      rules.push({
        type: 'required',
        message: messages.required,
        when: settings.when
      });
    }
    if (settings.minLength) {
      rules.push({
        type: 'minLength',
        value: settings.minLength,
        message: messages.minLength,
        when: settings.when
      });
    }
    if (settings.maxLength && messages.maxLength) {
      rules.push({
        type: 'maxLength',
        value: settings.maxLength,
        message: messages.maxLength,
        when: settings.when
      });
    }

    return rules;
  }

  function numberRules(messages, options) {
    var settings = extend({
      required: false,
      min: null,
      when: null
    }, options || {});
    var rules = [];

    if (settings.required) {
      rules.push({
        type: 'required',
        message: messages.required,
        when: settings.when
      });
    }

    rules.push({
      type: 'number',
      message: messages.type,
      when: settings.when
    });

    if (settings.min != null) {
      rules.push({
        type: 'min',
        value: settings.min,
        message: messages.min,
        when: settings.when
      });
    }

    return rules;
  }

  function integerRules(messages, options) {
    var settings = extend({
      required: false,
      min: null,
      when: null
    }, options || {});
    var rules = [];

    if (settings.required) {
      rules.push({
        type: 'required',
        message: messages.required,
        when: settings.when
      });
    }

    rules.push({
      type: 'integer',
      message: messages.type,
      when: settings.when
    });

    if (settings.min != null) {
      rules.push({
        type: 'min',
        value: settings.min,
        message: messages.min,
        when: settings.when
      });
    }

    return rules;
  }

  function optionRules(messages, options) {
    return integerRules(messages, extend({ min: 1 }, options || {}));
  }

  function validateImageField(values, context, api) {
    var imageMode = normalizeText(values.imageMode || '').toLowerCase();
    var hasCurrentImage = Boolean(context && context.currentImageUrl);

    if (imageMode === 'keep') {
      if (!hasCurrentImage) api.addError('imageMode', 'Image is required.');
      return;
    }
    if (imageMode === 'remove') {
      api.addError('imageMode', 'Image is required.');
      return;
    }
    if (imageMode === 'upload') {
      if (!context || (!context.uploadFile && !context.uploadData && !context.uploadPending)) {
        api.addError('imageUpload', 'Image is required.');
        return;
      }

      var uploadImageError = getUploadImageError(context);
      if (uploadImageError) api.addError('imageUpload', uploadImageError);
      return;
    }
    if (imageMode === 'url') {
      if (isBlank(values.imageUrl)) {
        api.addError('imageUrl', 'Image is required.');
        return;
      }
      if (!isValidImageReference(values.imageUrl)) {
        api.addError('imageUrl', 'Please provide a valid image.');
      }
      return;
    }
    if (imageMode === 'placeholder') {
      if (isBlank(values.imagePlaceholder)) {
        api.addError('imagePlaceholder', 'Choose a placeholder image.');
        return;
      }
      if (!isValidPlaceholderKey(values.imagePlaceholder)) {
        api.addError('imagePlaceholder', 'Choose a valid placeholder image.');
      }
      return;
    }

    api.addError('imageMode', 'Please provide a valid image.');
  }

  function validateOptionalImageField(values, context, api) {
    var imageMode = normalizeText(values.imageMode || '').toLowerCase();

    if (!imageMode || imageMode === 'keep' || imageMode === 'remove') return;

    if (imageMode === 'upload') {
      if (!context || (!context.uploadFile && !context.uploadData && !context.uploadPending)) {
        api.addError('imageUpload', 'Choose an image or switch photo source.');
        return;
      }

      var uploadImageError = getUploadImageError(context);
      if (uploadImageError) api.addError('imageUpload', uploadImageError);
      return;
    }
    if (imageMode === 'url') {
      if (isBlank(values.imageUrl)) {
        api.addError('imageUrl', 'Image link is required for this photo source.');
        return;
      }
      if (!isValidImageReference(values.imageUrl)) {
        api.addError('imageUrl', 'Please provide a valid image.');
      }
      return;
    }
    if (imageMode === 'placeholder') {
      if (isBlank(values.imagePlaceholder)) {
        api.addError('imagePlaceholder', 'Choose a placeholder image.');
        return;
      }
      if (!isValidPlaceholderKey(values.imagePlaceholder)) {
        api.addError('imagePlaceholder', 'Choose a valid placeholder image.');
      }
      return;
    }

    api.addError('imageMode', 'Please provide a valid image.');
  }

  var validators = {
    required: function(rule, value) {
      if (isBlank(value)) return rule.message;
      return null;
    },
    minLength: function(rule, value) {
      if (isBlank(value)) return null;
      if (normalizeText(value).length < rule.value) return rule.message;
      return null;
    },
    maxLength: function(rule, value) {
      if (isBlank(value)) return null;
      if (normalizeText(value).length > rule.value) return rule.message;
      return null;
    },
    number: function(rule, value) {
      if (isBlank(value)) return null;
      if (!isValidNumber(value)) return rule.message;
      return null;
    },
    integer: function(rule, value) {
      if (isBlank(value)) return null;
      if (!isValidInteger(value)) return rule.message;
      return null;
    },
    min: function(rule, value) {
      if (isBlank(value) || !isValidNumber(value)) return null;
      if (Number(value) < Number(rule.value)) return rule.message;
      return null;
    },
    date: function(rule, value) {
      if (isBlank(value)) return null;
      if (!DATE_PATTERN.test(normalizeText(value))) return rule.message;
      return null;
    }
  };

  function itemSchema(context) {
    var category = context && context.category ? context.category : null;
    var isMultiPrice = Boolean(category && category.allowMultiPrice);

    return {
      fields: {
        categoryId: optionRules({
          required: 'Category is required.',
          type: 'Choose a valid category.',
          min: 'Choose a valid category.'
        }, { required: true }),
        name: textRules({
          required: 'Item name is required.',
          minLength: 'Item name must be at least 2 characters.',
          maxLength: 'Item name must be 160 characters or fewer.'
        }, { required: true, minLength: 2, maxLength: 160 }),
        description: textRules({
          required: 'Description is required.',
          minLength: 'Description must be at least 5 characters.',
          maxLength: 'Description must be 600 characters or fewer.'
        }, { required: true, minLength: 5, maxLength: 600 }),
        priceType: textRules({
          required: 'Price type is required.'
        }, { required: true }),
        priceSingle: numberRules({
          required: 'Price is required.',
          type: 'Price must be a valid number.',
          min: 'Price cannot be negative.'
        }, {
          required: !isMultiPrice,
          min: 0,
          when: function(values) {
            return normalizeText(values.priceType || 'numeric') === 'numeric' && !isMultiPrice;
          }
        }),
        priceMedium: numberRules({
          type: 'Medium price must be a valid number.',
          min: 'Medium price cannot be negative.'
        }, {
          min: 0,
          when: function(values) {
            return normalizeText(values.priceType || 'numeric') === 'numeric' && isMultiPrice;
          }
        }),
        priceLarge: numberRules({
          type: 'Large price must be a valid number.',
          min: 'Large price cannot be negative.'
        }, {
          min: 0,
          when: function(values) {
            return normalizeText(values.priceType || 'numeric') === 'numeric' && isMultiPrice;
          }
        }),
        displayOrder: integerRules({
          type: 'Sort order must be a whole number.',
          min: 'Sort order must be at least 1.'
        }, { min: 1 }),
        promotionId: optionRules({
          type: 'Choose a valid offer.',
          min: 'Choose a valid offer.'
        }, { min: 1 }),
        imageUrl: textRules({
          required: 'Image is required.',
          maxLength: 'Image link must be 500 characters or fewer.'
        }, {
          required: false,
          maxLength: 500,
          when: function(values) {
            return normalizeText(values.imageMode || '').toLowerCase() === 'url';
          }
        })
      },
      custom: [
        function(values, ctx, api) {
          var type = normalizeText(values.priceType || 'numeric');
          if (type !== 'numeric' && type !== 'tbd' && type !== 'in_store') {
            api.addError('priceType', 'Choose a valid price type.');
          }
          if (type !== 'numeric') return;
          if (!isMultiPrice) return;
          if (!isBlank(values.priceMedium) || !isBlank(values.priceLarge)) return;
          api.addError('priceMedium', 'Add at least one size price.');
          api.addError('priceLarge', 'Add at least one size price.');
        },
        validateImageField
      ]
    };
  }

  function categorySchema() {
    return {
      fields: {
        name: textRules({
          required: 'Section name is required.',
          minLength: 'Section name must be at least 2 characters.',
          maxLength: 'Section name must be 120 characters or fewer.'
        }, { required: true, minLength: 2, maxLength: 120 }),
        description: textRules({
          minLength: 'Description must be at least 5 characters.',
          maxLength: 'Description must be 400 characters or fewer.'
        }, { minLength: 5, maxLength: 400 }),
        displayOrder: integerRules({
          type: 'Display order must be a whole number.',
          min: 'Display order must be at least 1.'
        }, { min: 1 })
      }
    };
  }

  function featuredSchema() {
    return {
      fields: {
        menuItemId: optionRules({
          required: 'Choose a menu item to spotlight.',
          type: 'Choose a valid menu item.',
          min: 'Choose a valid menu item.'
        }, { required: true, min: 1 }),
        headline: textRules({
          required: 'Headline is required.',
          minLength: 'Headline must be at least 2 characters.',
          maxLength: 'Headline must be 160 characters or fewer.'
        }, { required: true, minLength: 2, maxLength: 160 }),
        subtext: textRules({
          minLength: 'Subtext must be at least 5 characters.',
          maxLength: 'Subtext must be 600 characters or fewer.'
        }, { minLength: 5, maxLength: 600 }),
        displayOrder: integerRules({
          type: 'Display order must be a whole number.',
          min: 'Display order must be at least 1.'
        }, { min: 1 }),
        promotionId: optionRules({
          type: 'Choose a valid offer.',
          min: 'Choose a valid offer.'
        }, { min: 1 }),
        imageUrl: textRules({
          required: 'Image is required.',
          maxLength: 'Image link must be 500 characters or fewer.'
        }, {
          maxLength: 500,
          when: function(values) {
            return normalizeText(values.imageMode || '').toLowerCase() === 'url';
          }
        })
      },
      custom: [validateOptionalImageField]
    };
  }

  function promotionSchema() {
    return {
      fields: {
        title: textRules({
          required: 'Offer title is required.',
          minLength: 'Offer title must be at least 2 characters.',
          maxLength: 'Offer title must be 160 characters or fewer.'
        }, { required: true, minLength: 2, maxLength: 160 }),
        badgeText: textRules({
          maxLength: 'Offer label must be 80 characters or fewer.'
        }, { maxLength: 80 }),
        description: textRules({
          minLength: 'Details must be at least 5 characters.',
          maxLength: 'Details must be 600 characters or fewer.'
        }, { minLength: 5, maxLength: 600 }),
        discountValue: numberRules({
          required: 'Amount off is required.',
          type: 'Amount off must be a valid number.',
          min: 'Amount off cannot be negative.'
        }, {
          required: false,
          min: 0,
          when: function(values) {
            return normalizeText(values.discountType || 'text').toLowerCase() !== 'text';
          }
        }),
        startDate: [
          {
            type: 'date',
            message: 'Start date must use YYYY-MM-DD format.'
          }
        ],
        endDate: [
          {
            type: 'date',
            message: 'End date must use YYYY-MM-DD format.'
          }
        ],
        displayOrder: integerRules({
          type: 'Display order must be a whole number.',
          min: 'Display order must be at least 1.'
        }, { min: 1 })
      },
      custom: [
        function(values, ctx, api) {
          var discountType = normalizeText(values.discountType || 'text').toLowerCase();
          if (discountType === 'text') return;
          if (isBlank(values.discountValue)) {
            api.addError('discountValue', 'Amount off is required.');
            return;
          }
          if (discountType === 'percentage' && isValidNumber(values.discountValue) && Number(values.discountValue) > 100) {
            api.addError('discountValue', 'Percentage discounts cannot exceed 100.');
          }
        },
        function(values, ctx, api) {
          if (!normalizeText(values.startDate) || !normalizeText(values.endDate)) return;
          if (normalizeText(values.startDate) > normalizeText(values.endDate)) {
            api.addError('startDate', 'Start date must be on or before the end date.');
            api.addError('endDate', 'End date must be on or after the start date.');
          }
        }
      ]
    };
  }

  function getSchema(formName, context) {
    if (formName === 'category') return categorySchema(context);
    if (formName === 'item') return itemSchema(context);
    if (formName === 'featured') return featuredSchema(context);
    if (formName === 'promotion') return promotionSchema(context);
    return { fields: {}, custom: [] };
  }

  function validateRules(fieldName, rules, values, context, errors) {
    var value = values[fieldName];

    (rules || []).forEach(function(rule) {
      var validator = validators[rule.type];
      if (!validator) return;
      if (typeof rule.when === 'function' && !rule.when(values, context)) return;

      var message = validator(rule, value, values, context);
      if (message) addError(errors, fieldName, message);
    });
  }

  function runCustomValidators(customValidators, values, context, errors) {
    (customValidators || []).forEach(function(validator) {
      validator(values, context, {
        addError: function(fieldName, message) {
          addError(errors, fieldName, message);
        }
      });
    });
  }

  function validateForm(formName, values, context) {
    var sanitizedValues = sanitizeValues(values || {});
    var schema = getSchema(formName, context || {});
    var errors = {};

    Object.keys(schema.fields || {}).forEach(function(fieldName) {
      validateRules(fieldName, schema.fields[fieldName], sanitizedValues, context || {}, errors);
    });

    runCustomValidators(schema.custom, sanitizedValues, context || {}, errors);

    return {
      isValid: !Object.keys(errors).length,
      errors: errors,
      values: sanitizedValues
    };
  }

  global.AdminValidation = {
    validateForm: validateForm
  };
})(window);

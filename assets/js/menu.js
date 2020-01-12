(window.navigation = window.navigation || {}),
  (function(n) {
    navigation.menu = {
      constants: {
        sectionTemplate: ".section-template",
        contentContainer: "#wrapper",
        startSectionMenuItem: "#homeMenu",
        startSection: "#home"
      },

      importSectionsToDOM: function() {
        const links = document.querySelectorAll('link[rel="import"]');
        Array.prototype.forEach.call(links, function(link) {
          let template = link.import.querySelector(navigation.menu.constants.sectionTemplate);
          let clone = document.importNode(template.content, true);
          document.querySelector(navigation.menu.constants.contentContainer).appendChild(clone);
        });
      },

      showStartSection: function() {
        $(this.constants.startSectionMenuItem).click();
        $(this.constants.startSection).fadeIn("fast");
      },

      hideAllSections: function() {
        $(this.constants.contentContainer + ">section").hide();
      },

      init: function() {
        this.importSectionsToDOM();
        this.showStartSection();

        $(document.body).click(function(e) {
          let dropDowns = $(".drop-down");
          let dropDownsWhite = $(".drop-down-white");
          dropDowns.push.apply(dropDowns, dropDownsWhite);
          dropDowns.each((index, dropdown) => {
            if (
              $(dropdown)
                .find("ul")
                .is(":visible") &&
              $(e.target).closest($(dropdown)).length === 0
            ) {
              $(dropdown)
                .find("ul")
                .hide();
              $(dropdown)
                .find("a")
                .removeClass("expanded");
            }
          });
        });
      }
    };

    n(function() {
      navigation.menu.init();
    });
  })(jQuery);

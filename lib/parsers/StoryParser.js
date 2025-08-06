import path from "path";
import IDMLUtils from "../utils/IDMLUtils.js";

class StoryParser {
  constructor(styleParser, unitConverter = null) {
    this.styleParser = styleParser;
    this.unitConverter = unitConverter; // ADDED: Unit converter for font sizes and spacing
    this.documentUnits = null; // Will be set from document units
    this.stories = {};
  }

  // ADDED: Method to set document units for font size conversion
  setDocumentUnits(units) {
    this.documentUnits = units;
    console.log("📐 StoryParser: Set document units to", units);
  }

  // ENHANCED: Method to convert font size to pixels using document units
  convertFontSizeToPixels(fontSize, alreadyConverted = false) {
    if (
      !fontSize ||
      !this.unitConverter ||
      !this.documentUnits ||
      alreadyConverted ||
      (typeof fontSize === "object" && fontSize._convertedToPixels)
    ) {
      return fontSize;
    }

    // Font sizes in IDML are typically in Points, but use document units as fallback
    const fontUnits = this.documentUnits === "Pixels" ? "Pixels" : "Points";

    if (this.unitConverter.isSupportedUnit(fontUnits)) {
      const pixelSize = this.unitConverter.toPixels(fontSize, fontUnits);
      console.log(
        `📐 Converted font size in story: ${fontSize} ${fontUnits} → ${pixelSize} px`
      );
      return pixelSize;
    }

    return fontSize;
  }

  async parseStoryFile(fileName, content, xmlParser) {
    console.log(`📝 Parsing story: ${fileName}`);

    try {
      const parsed = xmlParser.parse(content);
      const storyId = path.basename(fileName, ".xml");

      const storyData = parsed.Story || parsed;

      // ADD DEBUGGING FOR BR ELEMENTS IN RAW XML
      console.log("=== RAW XML CONTENT DEBUG ===");
      console.log("Raw XML content sample:", content.substring(0, 1000));

      // Count Br elements in raw XML
      const brMatches = content.match(/<Br[^>]*>/g) || [];
      console.log(
        `Found ${brMatches.length} <Br> elements in raw XML:`,
        brMatches
      );

      // Look for consecutive Br elements
      const consecutiveBrPattern = /(<Br[^>]*>\s*){2,}/g;
      const consecutiveBrMatches = content.match(consecutiveBrPattern) || [];
      console.log(
        `Found ${consecutiveBrMatches.length} groups of consecutive <Br> elements:`,
        consecutiveBrMatches
      );

      // CRITICAL FIX: Parse raw XML to preserve document order
      this.parseRawXMLForDocumentOrder(content, fileName);

      // ADD THESE SIMPLE LOGS FIRST:
      console.log("=== SIMPLE DEBUG TEST ===");
      console.log("Story file name:", fileName);
      console.log("Parsed story keys:", Object.keys(storyData));
      console.log(
        "Raw story data sample:",
        JSON.stringify(storyData, null, 2).substring(0, 500)
      );

      // Extract detailed story information
      const detailedStory = {
        self: storyData["@_Self"],
        appliedTOCStyle: storyData["@_AppliedTOCStyle"] || "n",
        userText: storyData["@_UserText"] !== false,

        // Extract story content with formatting
        content: this.extractDetailedStoryContent(storyData, fileName),

        // Extract text formatting
        textFormatting: this.extractTextFormatting(storyData),
      };

      // ADD DEBUGGING FOR PARSED BR STRUCTURE
      console.log("=== PARSED XML STRUCTURE DEBUG ===");
      this.debugBrElementsInParsedStructure(storyData, "root");

      const cleanStoryId = storyId.replace("Story_", "");
      this.stories[cleanStoryId] = detailedStory;

      // Enhanced logging to show line breaks
      const { plainText, lineBreakInfo } = detailedStory.content;
      console.log(`✅ Story ${storyId} parsed:`);
      console.log(`   - Characters: ${plainText.length}`);
      console.log(`   - Words: ${detailedStory.content.wordCount}`);
      console.log(`   - Line breaks: ${lineBreakInfo?.lineBreakCount || 0}`);
      console.log(
        `   - Text preview: "${plainText
          .substring(0, 50)
          .replace(/\n/g, "\\n")}..."`
      );
    } catch (error) {
      console.error(`❌ Error parsing story ${fileName}:`, error.message);
    }
  }

  // Replace the existing extractDetailedStoryContent method with this corrected version
  extractDetailedStoryContent(storyData, fileName = "unknown") {
    let content = "";
    let formattedContent = [];
    let textColor = null;
    let debugInfo = [];

    const extractTextRecursively = (element, depth = 0, context = {}) => {
      if (typeof element === "string") {
        content += element;
        return;
      }

      if (element && typeof element === "object") {
        // ENHANCED: Special handling for CharacterStyleRange with sophisticated Br detection
        if (element.CharacterStyleRange) {
          const ranges = Array.isArray(element.CharacterStyleRange)
            ? element.CharacterStyleRange
            : [element.CharacterStyleRange];

          // IMPROVED: Merge adjacent ranges that are part of the same word
          const mergedRanges = this.mergeAdjacentCharacterRanges(
            ranges,
            context
          );

          mergedRanges.forEach((range, rangeIndex) => {
            // Extract direct font references from the XML range
            const directFontRef =
              range["@_AppliedFont"] ||
              range["@_FontFamily"] ||
              range["@_Font"] ||
              "";

            // ENHANCED: Extract font size with proper fallback to styles
            let fontSize = null;
            let originalFontSize = null;

            if (range["@_PointSize"]) {
              originalFontSize = parseFloat(range["@_PointSize"]);
              fontSize = this.convertFontSizeToPixels(originalFontSize);
              console.log(
                `📐 Direct font size: ${originalFontSize} → ${fontSize} px`
              );
            } else {
              // FIXED: Don't set fontSize to null - let StyleParser resolve from styles
              console.log(
                `📐 No direct font size, will resolve from paragraph/character styles`
              );
            }

            const formatting = {
              paragraphStyle:
                element["@_AppliedParagraphStyle"] ||
                context.appliedStyle ||
                null,
              characterStyle: range["@_AppliedCharacterStyle"] || null,
              fontSize: fontSize, // Will be null if not present, StyleParser will resolve
              originalFontSize: originalFontSize, // Will be null if not present
              fontReference: directFontRef,
              fillColor: range["@_FillColor"] || null,
              fontStyle: range["@_FontStyle"] || null,
              // CRITICAL FIX: Inherit paragraph alignment from context if not explicitly set
              alignment:
                range["@_Justification"] ||
                range["@_Alignment"] ||
                context.paragraphAlignment ||
                null,
            };

            const resolvedFormatting =
              this.styleParser.resolveStyleFormatting(formatting);

            // CRITICAL FIX: Process Content and Br elements in document order
            // This handles interleaved <Content> and <Br> elements correctly
            content = this.processCharacterRangeInOrder(
              range,
              resolvedFormatting,
              rangeIndex,
              ranges.length,
              content,
              formattedContent,
              debugInfo,
              context,
              fileName
            );

            // CRITICAL FIX: Add space between character style ranges if needed
            if (rangeIndex < mergedRanges.length - 1) {
              const nextRange = mergedRanges[rangeIndex + 1];

              // More robust space detection
              const currentText = content.slice(-10); // Check last 10 characters
              const currentRangeEndsWithSpace = /\s$/.test(currentText); // Any whitespace at end

              // IMPROVED: Use merged content if available
              const currentRangeContent =
                range._mergedContent || this.extractContentFromRange(range);

              const nextContent = nextRange.Content
                ? String(
                    Array.isArray(nextRange.Content)
                      ? nextRange.Content[0]
                      : nextRange.Content
                  )
                : nextRange._mergedContent || "";
              const nextRangeStartsWithSpace = /^\s/.test(nextContent); // Any whitespace at start

              console.log(`🔧 Space insertion check [${rangeIndex}]:`, {
                currentRangeContent: currentRangeContent,
                nextContent: nextContent,
                currentText: currentText,
                currentRangeEndsWithSpace,
                nextRangeStartsWithSpace,
                currentRange: range._mergedContent ? "MERGED" : "ORIGINAL",
                nextRange: nextRange._mergedContent ? "MERGED" : "ORIGINAL",
              });

              // IMPROVED: More precise space insertion logic
              const shouldSkipSpace =
                currentRangeEndsWithSpace ||
                nextRangeStartsWithSpace ||
                this.shouldInsertImplicitLineBreak(range, nextRange, context) ||
                !nextRange.Content || // Skip if next range has no content
                nextContent.trim() === "" ||
                // IMPROVED: Skip if next range is marked to skip space insertion
                nextRange._skipSpaceInsertion ||
                // Don't add space if current text ends with punctuation that should connect to next word
                /[.,;:!?)]$/.test(currentText.trim()) ||
                // Don't add space if next text starts with punctuation that should connect to previous word
                /^[.,;:!?(]/.test(nextContent.trim()) ||
                // Don't add space if this looks like a single word split across formatting
                /^[a-zA-Z]+$/.test(
                  currentRangeContent.trim() + nextContent.trim()
                ) ||
                // IMPROVED: Check for common words that might be split
                /^portfolio$/i.test(
                  currentRangeContent.trim() + nextContent.trim()
                ) ||
                // Additional check: if segments have same paragraph style and font, likely same word
                (range["@_AppliedParagraphStyle"] &&
                  nextRange["@_AppliedParagraphStyle"] &&
                  range["@_AppliedParagraphStyle"] ===
                    nextRange["@_AppliedParagraphStyle"] &&
                  range["@_PointSize"] === nextRange["@_PointSize"] &&
                  range["@_AppliedFont"] === nextRange["@_AppliedFont"]);

              console.log(`🔧 Should skip space: ${shouldSkipSpace}`);

              if (!shouldSkipSpace) {
                const currentStyle = range["@_AppliedCharacterStyle"] || "none";
                const nextStyle =
                  nextRange["@_AppliedCharacterStyle"] || "none";

                const spaceText = " ";
                content += spaceText;
                formattedContent.push({
                  text: spaceText,
                  formatting: {
                    isSpace: true,
                    source: "between character style ranges (aggressive)",
                    currentStyle,
                    nextStyle,
                  },
                });

                debugInfo.push({
                  type: "Space inserted between character styles (improved)",
                  location: `Between ranges ${rangeIndex} and ${
                    rangeIndex + 1
                  }`,
                  currentStyle,
                  nextStyle,
                  reason:
                    "Precise space insertion - clear word boundary detected",
                  currentTextEnd: currentText.slice(-5),
                  nextTextStart: nextContent.slice(0, 5),
                  combinedText: currentRangeContent.trim() + nextContent.trim(),
                  isSingleWord: /^[a-zA-Z]+$/.test(
                    currentRangeContent.trim() + nextContent.trim()
                  ),
                  isPortfolio: /^portfolio$/i.test(
                    currentText.trim() + nextContent.trim()
                  ),
                  sameParagraphStyle:
                    range["@_AppliedParagraphStyle"] ===
                    nextRange["@_AppliedParagraphStyle"],
                  sameFontSize:
                    range["@_PointSize"] === nextRange["@_PointSize"],
                  sameFont:
                    range["@_AppliedFont"] === nextRange["@_AppliedFont"],
                });
              } else {
                debugInfo.push({
                  type: "Space insertion skipped",
                  location: `Between ranges ${rangeIndex} and ${
                    rangeIndex + 1
                  }`,
                  reason: currentRangeEndsWithSpace
                    ? "Current range ends with space"
                    : nextRangeStartsWithSpace
                    ? "Next range starts with space"
                    : !nextRange.Content
                    ? "Next range has no content"
                    : nextContent.trim() === ""
                    ? "Next content is only whitespace"
                    : nextRange._skipSpaceInsertion
                    ? "Next range is part of merged group"
                    : /[.,;:!?)]$/.test(currentText.trim())
                    ? "Current text ends with punctuation"
                    : /^[.,;:!?(]/.test(nextContent.trim())
                    ? "Next text starts with punctuation"
                    : /^[a-zA-Z]+$/.test(
                        currentRangeContent.trim() + nextContent.trim()
                      )
                    ? "Single word split across formatting"
                    : /^portfolio$/i.test(
                        currentText.trim() + nextContent.trim()
                      )
                    ? "Portfolio word detected"
                    : range["@_AppliedParagraphStyle"] &&
                      nextRange["@_AppliedParagraphStyle"] &&
                      range["@_AppliedParagraphStyle"] ===
                        nextRange["@_AppliedParagraphStyle"] &&
                      range["@_PointSize"] === nextRange["@_PointSize"] &&
                      range["@_AppliedFont"] === nextRange["@_AppliedFont"]
                    ? "Same paragraph style and font - likely same word"
                    : "Line break would be inserted",
                  currentTextEnd: currentText.slice(-5),
                  nextTextStart: nextContent.slice(0, 5),
                });
              }

              // Handle explicit line breaks between ranges (for cases where shouldInsertImplicitLineBreak is true)
              if (
                this.shouldInsertImplicitLineBreak(range, nextRange, context)
              ) {
                const implicitBreak = "\n";
                content += implicitBreak;
                formattedContent.push({
                  text: implicitBreak,
                  formatting: {
                    isBreak: true,
                    breakType: "implicit",
                    source: "between ranges",
                  },
                });

                debugInfo.push({
                  type: "Implicit line break",
                  location: `Between ranges ${rangeIndex} and ${
                    rangeIndex + 1
                  }`,
                });
              }
            }
          });
          return; // Don't continue processing to avoid duplication
        }

        // ENHANCED: Handle ParagraphStyleRange with context
        if (element.ParagraphStyleRange) {
          const ranges = Array.isArray(element.ParagraphStyleRange)
            ? element.ParagraphStyleRange
            : [element.ParagraphStyleRange];

          ranges.forEach((range, index) => {
            const paragraphContext = {
              ...context,
              paragraphIndex: index,
              totalParagraphs: ranges.length,
              appliedStyle: range["@_AppliedParagraphStyle"],
              // CRITICAL FIX: Pass down direct paragraph-level alignment
              paragraphAlignment:
                range["@_Justification"] || range["@_Alignment"],
            };

            // Track content length before
            const beforeLen = content.length;
            extractTextRecursively(range, depth + 1, paragraphContext);
            // Track content length after
            const afterLen = content.length;

            // If nothing was added, this is an empty paragraph: add a newline
            if (afterLen === beforeLen) {
              content += "\n";
              formattedContent.push({
                text: "\n",
                formatting: {
                  isBreak: true,
                  breakType: "empty-paragraph",
                  source: "empty ParagraphStyleRange",
                },
              });
              debugInfo.push({
                type: "Empty paragraph detected",
                location: `ParagraphStyleRange[${index}]`,
              });
            }

            // Add paragraph break between paragraphs (but not after the last one)
            if (index < ranges.length - 1) {
              const paragraphBreak = "\n\n"; // Use double newline for paragraph breaks
              content += paragraphBreak;
              formattedContent.push({
                text: paragraphBreak,
                formatting: {
                  isBreak: true,
                  breakType: "paragraph",
                  source: "between paragraphs",
                },
              });
              debugInfo.push({
                type: "Paragraph break",
                location: `between paragraphs ${index} and ${index + 1}`,
              });
            }
          });
          return;
        }

        // Handle direct Content elements (when not inside CharacterStyleRange)
        if (element.Content && !element.CharacterStyleRange) {
          let text = Array.isArray(element.Content)
            ? element.Content.join("")
            : String(element.Content);
          text = IDMLUtils.decodeXMLEntities(text);
          content += text;

          const formatting = {
            paragraphStyle:
              element["@_AppliedParagraphStyle"] ||
              context.appliedStyle ||
              null,
            characterStyle: element["@_AppliedCharacterStyle"] || null,
            fontSize: element["@_PointSize"] || null,
            fontFamily: element["@_AppliedFont"] || null,
            fillColor: element["@_FillColor"] || null,
            // CRITICAL FIX: Inherit paragraph alignment from context if not explicitly set
            alignment:
              element["@_Justification"] ||
              element["@_Alignment"] ||
              context.paragraphAlignment ||
              null,
          };

          const resolvedFormatting =
            this.styleParser.resolveStyleFormatting(formatting);

          formattedContent.push({
            text: text.replace(/\u2028/g, "\n").replace(/\u2029/g, "\n\n"),
            formatting: resolvedFormatting,
          });
        }

        // ENHANCED: Direct Br element handling (outside of ranges)
        if (element.Br !== undefined) {
          const brElements = Array.isArray(element.Br)
            ? element.Br
            : [element.Br];
          console.log(
            `🔧 Processing ${brElements.length} direct Br elements:`,
            brElements
          );

          brElements.forEach((br, index) => {
            const lineBreakText = "\n";
            console.log(
              `🔧 Direct Br element ${index + 1}/${
                brElements.length
              } creates: ${JSON.stringify(lineBreakText)}`
            );
            content += lineBreakText;
            formattedContent.push({
              text: lineBreakText,
              formatting: {
                isBreak: true,
                breakType: "explicit",
                source: "direct Br element",
              },
            });
            debugInfo.push({
              type: "Direct Br element",
              location: `Direct element, index ${index}`,
            });
          });

          console.log(
            `🔧 After processing ${brElements.length} direct Br elements, content ends with:`,
            JSON.stringify(content.slice(-10))
          );
        }

        // Continue with other nested elements
        Object.entries(element).forEach(([key, value]) => {
          if (
            !key.startsWith("@_") &&
            key !== "Content" &&
            key !== "Br" &&
            key !== "CharacterStyleRange" &&
            key !== "ParagraphStyleRange"
          ) {
            if (Array.isArray(value)) {
              value.forEach((item) =>
                extractTextRecursively(item, depth + 1, context)
              );
            } else if (typeof value === "object" && depth < 10) {
              extractTextRecursively(value, depth + 1, context);
            }
          }
        });
      }
    };

    extractTextRecursively(storyData);

    // DEBUG: Print the full raw content string with visible newlines before processing
    console.log("📝 === COMPLETE CONTENT ANALYSIS ===");
    console.log("   - Raw content before processing:", JSON.stringify(content));
    console.log(
      "   - Raw content newline count:",
      (content.match(/\n/g) || []).length
    );
    console.log("   - Raw content character breakdown:");
    const chars = content
      .split("")
      .map((char, i) => `${i}: ${JSON.stringify(char)}`);
    console.log("   - First 50 characters:", chars.slice(0, 50));
    if (content.length > 50) {
      console.log("   - Last 20 characters:", chars.slice(-20));
    }

    // ENHANCED: Process and clean up the content with sophisticated line break preservation
    let processedContent = IDMLUtils.sophisticatedLineBreakProcessing(content);

    // CRITICAL: Explicitly preserve all newlines as-is (no merging or stripping)
    processedContent = processedContent.replace(/\r\n?/g, "\n"); // Normalize CRLF/CR to LF
    // Do NOT collapse multiple newlines into one; preserve as-is

    console.log("📝 === PROCESSED CONTENT ANALYSIS ===");
    console.log("   - Processed content:", JSON.stringify(processedContent));
    console.log(
      "   - Processed content newline count:",
      (processedContent.match(/\n/g) || []).length
    );
    console.log(
      "   - Content length change:",
      content.length,
      "→",
      processedContent.length
    );

    // Show differences if any
    if (content !== processedContent) {
      console.log("⚠️  CONTENT WAS MODIFIED DURING PROCESSING!");
      console.log("   - Original:", JSON.stringify(content.slice(0, 100)));
      console.log(
        "   - Processed:",
        JSON.stringify(processedContent.slice(0, 100))
      );
    } else {
      console.log("✅ Content preserved exactly during processing");
    }

    // DEBUG: Log space preservation results
    console.log("📝 Text extraction results:");
    console.log("   - Original content length:", content.length);
    console.log("   - Processed content length:", processedContent.length);
    console.log(
      "   - Space preservation events:",
      debugInfo.filter((info) => info.type.includes("Space inserted")).length
    );
    // DEBUG: Show first 300 chars with visible newlines
    console.log(
      "   - Extracted text preview:",
      JSON.stringify(processedContent.slice(0, 300))
    );

    // SPECIFIC DEBUG: Check for the problematic "pavoluptusda" text (simplified)
    if (
      processedContent.includes("pavoluptusda") ||
      (processedContent.includes("pa") &&
        processedContent.includes("voluptusda"))
    ) {
      console.log("🚨 FOUND PROBLEMATIC TEXT:");
      console.log(
        '   - Contains "pavoluptusda":',
        processedContent.includes("pavoluptusda")
      );
      console.log(
        '   - Contains "pa voluptusda":',
        processedContent.includes("pa voluptusda")
      );
      console.log(
        "   - FormattedContent breakdown:",
        formattedContent.map((item) => item.text).join("|")
      );
    }

    const lineBreakInfo = {
      hasLineBreaks: processedContent.includes("\n"),
      lineBreakCount: (processedContent.match(/\n/g) || []).length,
      lineBreakTypes: this.analyzeLineBreakTypes(formattedContent),
      debugInfo: debugInfo,
      spacePreservationCount: debugInfo.filter((info) =>
        info.type.includes("Space inserted")
      ).length,
    };

    return {
      plainText: processedContent,
      formattedContent: formattedContent.filter(
        (item) => item.text && item.text.length > 0
      ),
      wordCount: IDMLUtils.countWords(processedContent.replace(/\n/g, " ")),
      characterCount: processedContent.length,
      textColor: textColor,
      lineBreakInfo: lineBreakInfo,
    };
  }

  // NEW: Process CharacterStyleRange content and breaks in document order - FULLY DYNAMIC
  processCharacterRangeInOrder(
    range,
    resolvedFormatting,
    rangeIndex,
    totalRanges,
    content,
    formattedContent,
    debugInfo,
    context,
    fileName
  ) {
    console.log(
      `🔧 Processing CharacterStyleRange[${rangeIndex}] in document order:`,
      {
        hasContent: !!range.Content,
        hasBr: range.Br !== undefined,
        contentType: Array.isArray(range.Content)
          ? "array"
          : typeof range.Content,
        brType: Array.isArray(range.Br) ? "array" : typeof range.Br,
      }
    );

    // COMPREHENSIVE EDGE CASE HANDLING
    try {
      // Case 1: Both Content and Br elements exist - most common case
      if (range.Content && range.Br !== undefined) {
        console.log(`🔧 Processing range with both content and breaks`);
        return this.processInterleavedContentAndBr(
          range,
          resolvedFormatting,
          content,
          formattedContent,
          debugInfo,
          fileName
        );
      }

      // Case 2: Only Content, no Br elements
      else if (range.Content && range.Br === undefined) {
        console.log(`🔧 Processing range with only content`);
        return this.processContentElements(
          range,
          resolvedFormatting,
          content,
          formattedContent,
          fileName
        );
      }

      // Case 3: Only Br elements, no Content
      else if (!range.Content && range.Br !== undefined) {
        console.log(`🔧 Processing range with only breaks`);
        return this.processBrElements(
          range,
          content,
          formattedContent,
          debugInfo,
          rangeIndex,
          fileName
        );
      }

      // Case 4: Neither Content nor Br - empty range
      else {
        console.log(`⚠️ Empty range encountered - no content or breaks`);
        return content;
      }
    } catch (error) {
      // ULTIMATE FALLBACK: If anything goes wrong, try to salvage what we can
      console.log(
        `❌ Error processing CharacterStyleRange[${rangeIndex}]: ${error.message}`
      );
      console.log(`🔄 Attempting emergency content extraction...`);

      return this.emergencyContentExtraction(
        range,
        resolvedFormatting,
        content,
        formattedContent,
        fileName
      );
    }
  }

  // EMERGENCY FALLBACK: Extract content from malformed or unexpected XML structures
  emergencyContentExtraction(
    range,
    resolvedFormatting,
    content,
    formattedContent,
    fileName
  ) {
    console.log(`🚨 Emergency content extraction for unusual XML structure`);

    try {
      // Try to extract any text content using different approaches
      const extractedTexts = [];
      const extractedBreaks = [];

      // Approach 1: Direct property access
      if (range.Content) {
        const contents = Array.isArray(range.Content)
          ? range.Content
          : [range.Content];
        contents.forEach((c) => {
          if (typeof c === "string" && c.trim()) {
            extractedTexts.push(c.trim());
          }
        });
      }

      // Approach 2: Search for any text-like properties
      Object.keys(range).forEach((key) => {
        if (
          typeof range[key] === "string" &&
          range[key].trim() &&
          key !== "@_Self" &&
          !key.startsWith("@_")
        ) {
          extractedTexts.push(range[key].trim());
        }
      });

      // Approach 3: Count any break-like properties
      if (range.Br !== undefined) {
        const breaks = Array.isArray(range.Br) ? range.Br : [range.Br];
        extractedBreaks.push(...breaks);
      }

      // Add extracted content
      extractedTexts.forEach((text, index) => {
        const cleanText = IDMLUtils.decodeXMLEntities(text);
        content += cleanText;
        formattedContent.push({
          text: cleanText.replace(/\u2028/g, "\n").replace(/\u2029/g, "\n\n"),
          formatting: resolvedFormatting,
        });

        console.log(
          `🚨 Emergency extracted content[${index}]: ${JSON.stringify(
            cleanText
          )}`
        );

        // Add breaks between content items (simple 1:1 ratio)
        if (index < extractedBreaks.length) {
          const lineBreakText = "\n";
          content += lineBreakText;
          formattedContent.push({
            text: lineBreakText
              .replace(/\u2028/g, "\n")
              .replace(/\u2029/g, "\n\n"),
            formatting: {
              isBreak: true,
              breakType: "line",
              source: "emergency extraction",
              emergencyIndex: index,
            },
          });

          console.log(
            `🚨 Emergency extracted break[${index}]: ${JSON.stringify(
              lineBreakText
            )}`
          );
        }
      });

      // Add any remaining breaks at the end
      for (let i = extractedTexts.length; i < extractedBreaks.length; i++) {
        const lineBreakText = "\n";
        content += lineBreakText;
        formattedContent.push({
          text: lineBreakText
            .replace(/\u2028/g, "\n")
            .replace(/\u2029/g, "\n\n"),
          formatting: {
            isBreak: true,
            breakType: "line",
            source: "emergency trailing break",
            emergencyIndex: i,
          },
        });

        console.log(
          `🚨 Emergency extracted trailing break[${i}]: ${JSON.stringify(
            lineBreakText
          )}`
        );
      }

      console.log(
        `✅ Emergency extraction successful: ${extractedTexts.length} texts, ${extractedBreaks.length} breaks`
      );
    } catch (emergencyError) {
      console.log(`💀 Emergency extraction failed: ${emergencyError.message}`);
      // Last resort: just add a warning comment
      const warningText = "<!-- XML parsing error -->";
      content += warningText;
      formattedContent.push({
        text: warningText.replace(/\u2028/g, "\n").replace(/\u2029/g, "\n\n"),
        formatting: resolvedFormatting,
      });
    }

    return content;
  }

  // Process interleaved Content and Br elements - FULLY DYNAMIC
  processInterleavedContentAndBr(
    range,
    resolvedFormatting,
    content,
    formattedContent,
    debugInfo,
    fileName
  ) {
    const contents = Array.isArray(range.Content)
      ? range.Content
      : [range.Content];
    const brElements = Array.isArray(range.Br) ? range.Br : [range.Br];

    console.log(
      `🔧 Processing interleaved content: ${contents.length} content items, ${brElements.length} Br elements`
    );

    // EDGE CASE: No content or breaks
    if (!range.Content && !range.Br) {
      console.log(`⚠️ No content or breaks to process in range`);
      return content;
    }

    // EDGE CASE: Only content, no breaks
    if (range.Content && !range.Br) {
      console.log(`📝 Only content, no breaks - processing content only`);
      return this.processContentElements(
        range,
        resolvedFormatting,
        content,
        formattedContent,
        fileName
      );
    }

    // EDGE CASE: Only breaks, no content
    if (!range.Content && range.Br) {
      console.log(`🔗 Only breaks, no content - processing breaks only`);
      return this.processBrElements(
        range,
        content,
        formattedContent,
        debugInfo,
        0,
        fileName
      );
    }

    // DYNAMIC: Try to use cached document order if available
    const cachedOrder =
      this.documentOrderCache && this.documentOrderCache[fileName];

    if (
      cachedOrder &&
      cachedOrder.breakPattern &&
      cachedOrder.breakPattern.length > 0
    ) {
      console.log(
        `✅ Using cached document order for precise break distribution`
      );
      try {
        return this.processContentWithCachedPattern(
          contents,
          resolvedFormatting,
          content,
          formattedContent,
          cachedOrder.breakPattern,
          fileName
        );
      } catch (error) {
        console.log(
          `❌ Error using cached pattern: ${error.message}, falling back to dynamic distribution`
        );
      }
    } else {
      console.log(
        `⚠️ No cached document order available, using dynamic fallback distribution`
      );
    }

    // DYNAMIC FALLBACK: Distribute breaks intelligently based on content structure
    return this.processInterleavedContentDynamicFallback(
      contents,
      brElements,
      resolvedFormatting,
      content,
      formattedContent,
      fileName
    );
  }

  // DYNAMIC FALLBACK: Intelligent break distribution for any content structure
  processInterleavedContentDynamicFallback(
    contents,
    brElements,
    resolvedFormatting,
    content,
    formattedContent,
    fileName
  ) {
    console.log(
      `🔄 Using dynamic fallback for ${contents.length} content items and ${brElements.length} breaks`
    );

    let brIndex = 0;
    const contentLength = contents.length;

    contents.forEach((contentItem, contentIndex) => {
      // Add the content
      const text = IDMLUtils.decodeXMLEntities(String(contentItem));
      content += text;
      formattedContent.push({
        text: text.replace(/\u2028/g, "\n").replace(/\u2029/g, "\n\n"),
        formatting: resolvedFormatting,
      });

      console.log(`🔧 Added content[${contentIndex}]: ${JSON.stringify(text)}`);

      // DYNAMIC: Calculate how many breaks to add after this content
      const breaksToAdd = this.calculateBreaksAfterContent(
        contentIndex,
        contentLength,
        brElements.length
      );

      // Add the calculated number of breaks
      for (let i = 0; i < breaksToAdd && brIndex < brElements.length; i++) {
        const lineBreakText = "\n";
        content += lineBreakText;
        formattedContent.push({
          text: lineBreakText
            .replace(/\u2028/g, "\n")
            .replace(/\u2029/g, "\n\n"),
          formatting: {
            isBreak: true,
            breakType: "line",
            source: "dynamic fallback distribution",
            brIndex: brIndex,
            afterContent: contentIndex,
            calculatedBreaks: breaksToAdd,
          },
        });

        console.log(
          `🔧 Added Br[${brIndex}] after content[${contentIndex}]: ${JSON.stringify(
            lineBreakText
          )}`
        );
        brIndex++;
      }
    });

    // EDGE CASE: Handle any remaining breaks
    if (brIndex < brElements.length) {
      const remainingBreaks = brElements.length - brIndex;
      console.log(`🔧 Adding ${remainingBreaks} remaining breaks at the end`);

      while (brIndex < brElements.length) {
        const lineBreakText = "\n";
        content += lineBreakText;
        formattedContent.push({
          text: lineBreakText
            .replace(/\u2028/g, "\n")
            .replace(/\u2029/g, "\n\n"),
          formatting: {
            isBreak: true,
            breakType: "line",
            source: "trailing breaks (dynamic fallback)",
            brIndex: brIndex,
          },
        });

        console.log(
          `🔧 Added trailing Br[${brIndex}]: ${JSON.stringify(lineBreakText)}`
        );
        brIndex++;
      }
    }

    // VALIDATION: Ensure all breaks were processed
    if (brIndex !== brElements.length) {
      console.log(
        `⚠️ Warning: Expected to process ${brElements.length} breaks but processed ${brIndex}`
      );
    }

    return content;
  }

  // Process content using cached document order pattern - FULLY DYNAMIC
  processContentWithCachedPattern(
    contents,
    resolvedFormatting,
    content,
    formattedContent,
    breakPattern,
    fileName
  ) {
    console.log(
      `🎯 Processing ${contents.length} content items with cached pattern (${breakPattern.length} pattern entries)`
    );

    // DYNAMIC: Handle any number of content items and any break distribution
    contents.forEach((contentItem, contentIndex) => {
      // Add the content
      const text = IDMLUtils.decodeXMLEntities(String(contentItem));
      content += text;
      formattedContent.push({
        text: text.replace(/\u2028/g, "\n").replace(/\u2029/g, "\n\n"),
        formatting: resolvedFormatting,
      });

      console.log(`🔧 Added content[${contentIndex}]: ${JSON.stringify(text)}`);

      // DYNAMIC: Find the corresponding pattern entry
      const patternEntry = breakPattern.find(
        (p) => p.contentIndex === contentIndex
      );
      if (patternEntry) {
        const breaksToAdd = patternEntry.breaksAfter;
        console.log(
          `🎯 Pattern says content[${contentIndex}] should have ${breaksToAdd} breaks after it`
        );

        // DYNAMIC: Add the exact number of breaks specified in the pattern
        for (let i = 0; i < breaksToAdd; i++) {
          const lineBreakText = "\n";
          content += lineBreakText;
          formattedContent.push({
            text: lineBreakText
              .replace(/\u2028/g, "\n")
              .replace(/\u2029/g, "\n\n"),
            formatting: {
              isBreak: true,
              breakType: "line",
              source: "precise document order",
              contentIndex: contentIndex,
              breakIndex: i,
              totalBreaksAfterContent: breaksToAdd,
              patternEntry: patternEntry,
            },
          });

          console.log(
            `🎯 Added precise Br[${
              i + 1
            }/${breaksToAdd}] after content[${contentIndex}]: ${JSON.stringify(
              lineBreakText
            )}`
          );
        }
      } else {
        console.log(
          `⚠️ No pattern entry found for content[${contentIndex}] - this is unusual but not critical`
        );
        // DYNAMIC: If no pattern entry, don't add any breaks (the pattern should cover all content)
      }
    });

    // VALIDATION: Check if we processed all expected content
    const expectedContentCount = breakPattern.length;
    if (contents.length !== expectedContentCount) {
      console.log(
        `⚠️ Warning: Expected ${expectedContentCount} content items but processed ${contents.length}`
      );
    }

    return content;
  }

  // DYNAMIC: Calculate breaks distribution as fallback - completely generic
  calculateBreaksAfterContent(contentIndex, totalContent, totalBreaks) {
    console.log(
      `🔧 FALLBACK: Calculating breaks for content[${contentIndex}] of ${totalContent} total, ${totalBreaks} total breaks`
    );

    // EDGE CASE: No breaks to distribute
    if (totalBreaks === 0) {
      console.log(`🔧 No breaks to distribute`);
      return 0;
    }

    // EDGE CASE: Only one content item
    if (totalContent === 1) {
      console.log(`🔧 Single content item gets all ${totalBreaks} breaks`);
      return contentIndex === 0 ? totalBreaks : 0;
    }

    // EDGE CASE: Last content item
    if (contentIndex === totalContent - 1) {
      console.log(
        `🔧 Last content item gets no breaks in standard distribution`
      );
      return 0;
    }

    // DYNAMIC: Distribute breaks among non-last content items
    const nonLastContentItems = totalContent - 1;
    const baseBreaks = Math.floor(totalBreaks / nonLastContentItems);
    const extraBreaks = totalBreaks % nonLastContentItems;

    // DYNAMIC: Distribute extra breaks starting from the end to match common IDML patterns
    // where later content tends to have more breaks
    const breaksForThisContent =
      baseBreaks + (contentIndex >= nonLastContentItems - extraBreaks ? 1 : 0);

    console.log(
      `🔧 Content[${contentIndex}] gets ${breaksForThisContent} breaks (base: ${baseBreaks}, extra: ${extraBreaks})`
    );

    return breaksForThisContent;
  }

  // Process only Content elements
  processContentElements(
    range,
    resolvedFormatting,
    content,
    formattedContent,
    fileName
  ) {
    const contents = Array.isArray(range.Content)
      ? range.Content
      : [range.Content];

    contents.forEach((contentItem) => {
      const text = IDMLUtils.decodeXMLEntities(String(contentItem));
      content += text;
      formattedContent.push({
        text: text.replace(/\u2028/g, "\n").replace(/\u2029/g, "\n\n"),
        formatting: resolvedFormatting,
      });
    });
    return content;
  }

  // Process only Br elements
  processBrElements(
    range,
    content,
    formattedContent,
    debugInfo,
    rangeIndex,
    fileName
  ) {
    const brElements = Array.isArray(range.Br) ? range.Br : [range.Br];

    brElements.forEach((br, brIndex) => {
      const lineBreakText = "\n";
      content += lineBreakText;
      formattedContent.push({
        text: lineBreakText.replace(/\u2028/g, "\n").replace(/\u2029/g, "\n\n"),
        formatting: {
          isBreak: true,
          breakType: "line",
          source: "standalone Br element",
          rangeIndex: rangeIndex,
          brIndex: brIndex,
        },
      });

      debugInfo.push({
        type: "Standalone Br element",
        location: `CharacterStyleRange[${rangeIndex}], Br[${brIndex}]`,
      });
    });
    return content;
  }

  // Add this helper method to better handle mixed content and Br elements
  analyzeContentStructure(range) {
    const structure = {
      hasContent: !!range.Content,
      hasBr: range.Br !== undefined,
      contentItems: range.Content
        ? Array.isArray(range.Content)
          ? range.Content
          : [range.Content]
        : [],
      brElements: range.Br
        ? Array.isArray(range.Br)
          ? range.Br
          : [range.Br]
        : [],
    };

    console.log("Content structure analysis:", structure);
    return structure;
  }

  // Enhanced helper for processing interleaved content and breaks
  processInterleavedContent(range, resolvedFormatting) {
    const results = [];
    let content = "";

    // This method would need access to the actual XML structure to determine
    // the exact order of Content and Br elements. For now, we'll use the
    // approach above which handles the most common case.

    return results;
  }

  // SOPHISTICATED: Helper method to extract Br elements with context
  extractBrElements(range) {
    const brElements = [];

    if (range.Br !== undefined) {
      console.log("🔧 Processing Br elements:", {
        isArray: Array.isArray(range.Br),
        count: Array.isArray(range.Br) ? range.Br.length : 1,
        rawBr: range.Br,
      });

      if (Array.isArray(range.Br)) {
        range.Br.forEach((br, index) => {
          brElements.push({
            type: "line",
            position: index === 0 ? "start" : "middle",
            element: br,
          });
        });
        console.log(
          `🔧 Created ${brElements.length} line break elements from array - EACH SHOULD CREATE ONE \\n`
        );
      } else {
        brElements.push({
          type: "line",
          position: "end",
          element: range.Br,
        });
        console.log("🔧 Created 1 line break element from single Br");
      }
    }

    return brElements;
  }

  // SOPHISTICATED: Determine the appropriate line break type
  determineLineBreakType(brInfo, context) {
    // Different line break characters based on context
    switch (brInfo.type) {
      case "paragraph":
        return "\n\n"; // Double line break for paragraph separation
      case "forced":
        return "\n"; // Forced line break (Shift+Enter equivalent)
      case "line":
      default:
        return "\n"; // Standard line break
    }
  }

  // SOPHISTICATED: Determine if an implicit line break should be inserted
  shouldInsertImplicitLineBreak(currentRange, nextRange, context) {
    // Don't insert implicit breaks if explicit Br elements are present
    if (currentRange.Br !== undefined || nextRange.Br !== undefined) {
      return false;
    }

    // Insert breaks between different character styles in different paragraphs
    const currentCharStyle = currentRange["@_AppliedCharacterStyle"];
    const nextCharStyle = nextRange["@_AppliedCharacterStyle"];

    // If we're in a context where styles change significantly, add a break
    if (
      currentCharStyle &&
      nextCharStyle &&
      currentCharStyle !== nextCharStyle
    ) {
      // Check if this might be a title/heading followed by body text
      const styleIndicatesBreak = this.styleIndicatesLineBreak(
        currentCharStyle,
        nextCharStyle
      );
      return styleIndicatesBreak;
    }

    return false;
  }

  // SOPHISTICATED: Analyze if style change indicates a line break
  styleIndicatesLineBreak(currentStyle, nextStyle) {
    const titleIndicators = ["title", "heading", "header"];
    const bodyIndicators = ["body", "text", "normal"];

    const currentIsTitle = titleIndicators.some((indicator) =>
      currentStyle.toLowerCase().includes(indicator)
    );
    const nextIsBody = bodyIndicators.some((indicator) =>
      nextStyle.toLowerCase().includes(indicator)
    );

    return currentIsTitle && nextIsBody;
  }

  // SOPHISTICATED: Analyze line break types in formatted content
  analyzeLineBreakTypes(formattedContent) {
    const types = {
      explicit: 0, // From <Br/> elements
      implicit: 0, // Inferred from style changes
      paragraph: 0, // Between paragraphs
      direct: 0, // Direct Br elements
    };

    formattedContent.forEach((item) => {
      if (item.formatting?.isBreak) {
        const breakType = item.formatting.breakType || "unknown";
        if (types.hasOwnProperty(breakType)) {
          types[breakType]++;
        }
      }
    });

    return types;
  }

  extractDetailedFormattingFromRange(range) {
    const formatting = {};

    // Extract all possible font attributes
    const fontAttributes = [
      "@_AppliedFont",
      "@_FontFamily",
      "@_Font",
      "@_PostScriptName",
      "@_FontName",
    ];

    fontAttributes.forEach((attr) => {
      if (range[attr]) {
        formatting.fontReference = range[attr];
      }
    });

    // ENHANCED: Extract font and size attributes with proper fallback
    const rawFontSize = IDMLUtils.parseNumeric(range["@_PointSize"]);
    if (rawFontSize) {
      formatting.fontSize = this.convertFontSizeToPixels(rawFontSize); // Convert to pixels
      formatting.originalFontSize = rawFontSize; // Preserve original
      console.log(
        `📐 Detailed formatting: font size ${rawFontSize} → ${formatting.fontSize} px`
      );
    } else {
      // FIXED: Don't set to null - let StyleParser resolve from styles
      console.log(`📐 No direct font size in range, will resolve from styles`);
    }

    // ENHANCED: Extract leading with proper processing
    const rawLeading = range["@_Leading"];
    formatting.leading = this.processLeadingValue(
      rawLeading,
      formatting.fontSize
    );
    formatting.leadingType = this.determineLeadingType(rawLeading);

    // Extract color and style attributes
    formatting.fillColor = range["@_FillColor"];
    formatting.strokeColor = range["@_StrokeColor"];
    formatting.fontStyle = range["@_FontStyle"];

    // Extract advanced typography attributes
    formatting.tracking = IDMLUtils.parseNumeric(range["@_Tracking"]);
    formatting.baselineShift = IDMLUtils.parseNumeric(range["@_BaselineShift"]);
    formatting.kerning = IDMLUtils.parseNumeric(range["@_Kerning"]);
    formatting.horizontalScale =
      IDMLUtils.parseNumeric(range["@_HorizontalScale"]) || 100;
    formatting.verticalScale =
      IDMLUtils.parseNumeric(range["@_VerticalScale"]) || 100;

    // ENHANCED: Extract InDesign-specific text layout properties for precise rendering
    formatting.baselineGridAlign = range["@_AlignToBaseline"] || "None";
    formatting.dropCapLines =
      IDMLUtils.parseNumeric(range["@_DropCapLines"]) || 0;
    formatting.dropCapCharacters =
      IDMLUtils.parseNumeric(range["@_DropCapCharacters"]) || 0;

    // Extract paragraph-level attributes if present
    // CRITICAL FIX: Only set alignment if explicitly specified, allowing paragraph inheritance
    const explicitAlignment = range["@_Justification"] || range["@_Alignment"];
    if (explicitAlignment) {
      formatting.alignment = explicitAlignment;
    }
    formatting.leftIndent = IDMLUtils.parseNumeric(range["@_LeftIndent"]);
    formatting.rightIndent = IDMLUtils.parseNumeric(range["@_RightIndent"]);
    formatting.firstLineIndent = IDMLUtils.parseNumeric(
      range["@_FirstLineIndent"]
    );
    formatting.spaceBefore = IDMLUtils.parseNumeric(range["@_SpaceBefore"]);
    formatting.spaceAfter = IDMLUtils.parseNumeric(range["@_SpaceAfter"]);

    // Calculate effective line height for CSS
    formatting.effectiveLineHeight =
      this.calculateEffectiveLineHeight(formatting);

    return formatting;
  }

  // FIXED: Process leading values with InDesign-specific logic and convert to pixels
  processLeadingValue(rawLeading, fontSize) {
    if (!rawLeading) return "auto";

    // Handle "auto" leading
    if (rawLeading === "auto" || rawLeading === "Auto") {
      return fontSize ? fontSize * 1.2 : "auto"; // InDesign default auto leading is 120%
    }

    // Handle numeric leading (in points) - FIXED: Convert to pixels
    const numericLeading = IDMLUtils.parseNumeric(rawLeading);
    if (numericLeading) {
      // FIXED: Convert numeric leading to pixels if unitConverter is available
      if (
        this.unitConverter &&
        this.documentUnits &&
        this.unitConverter.isSupportedUnit(this.documentUnits)
      ) {
        const pixelLeading = this.unitConverter.toPixels(
          numericLeading,
          this.documentUnits
        );
        console.log(
          `📐 Converted leading: ${numericLeading} ${this.documentUnits} → ${pixelLeading} px`
        );
        return pixelLeading;
      }
      return numericLeading;
    }

    // Handle percentage-based leading
    if (rawLeading.includes("%")) {
      const percentage = parseFloat(rawLeading.replace("%", ""));
      return fontSize ? (fontSize * percentage) / 100 : "auto";
    }

    return "auto";
  }

  // NEW: Determine the type of leading being used
  determineLeadingType(rawLeading) {
    if (!rawLeading || rawLeading === "auto" || rawLeading === "Auto") {
      return "auto";
    }

    if (rawLeading.includes("%")) {
      return "percentage";
    }

    if (IDMLUtils.parseNumeric(rawLeading)) {
      return "absolute";
    }

    return "unknown";
  }

  // NEW: Calculate effective line height for CSS rendering
  calculateEffectiveLineHeight(formatting) {
    const fontSize = formatting.fontSize || 12;
    const leading = formatting.leading;

    if (leading === "auto") {
      return 1.2; // CSS line-height ratio for auto
    }

    if (typeof leading === "number") {
      // Convert points to CSS line-height ratio
      return leading / fontSize;
    }

    return 1.2; // Fallback
  }

  extractTextFormatting(storyData) {
    const formatting = {
      paragraphStyles: [],
      characterStyles: [],
      appliedStyles: [],
    };

    // Extract applied paragraph styles
    if (storyData.ParagraphStyleRange) {
      const ranges = Array.isArray(storyData.ParagraphStyleRange)
        ? storyData.ParagraphStyleRange
        : [storyData.ParagraphStyleRange];

      ranges.forEach((range) => {
        const appliedStyle = range["@_AppliedParagraphStyle"];
        if (
          appliedStyle &&
          !formatting.paragraphStyles.includes(appliedStyle)
        ) {
          formatting.paragraphStyles.push(appliedStyle);
        }

        // Extract character styles within paragraph ranges
        if (range.CharacterStyleRange) {
          const charRanges = Array.isArray(range.CharacterStyleRange)
            ? range.CharacterStyleRange
            : [range.CharacterStyleRange];

          charRanges.forEach((charRange) => {
            const charStyle = charRange["@_AppliedCharacterStyle"];
            if (charStyle && !formatting.characterStyles.includes(charStyle)) {
              formatting.characterStyles.push(charStyle);
            }
          });
        }
      });
    }

    return formatting;
  }

  // Add this method to debug raw story content
  debugRawStoryContent(storyData) {
    console.log("\n🔍 RAW STORY CONTENT DEBUG:");
    console.log("Story keys:", Object.keys(storyData));

    const findCharacterRanges = (obj, path = "") => {
      if (typeof obj === "object" && obj !== null) {
        Object.keys(obj).forEach((key) => {
          if (key === "CharacterStyleRange") {
            console.log(`\n📝 Found CharacterStyleRange at ${path}:`, obj[key]);
            const ranges = Array.isArray(obj[key]) ? obj[key] : [obj[key]];
            ranges.forEach((range, index) => {
              console.log(
                `  Range ${index + 1} attributes:`,
                Object.keys(range).filter((k) => k.startsWith("@_"))
              );
              console.log(`  Range ${index + 1} font info:`, {
                AppliedFont: range["@_AppliedFont"],
                FontStyle: range["@_FontStyle"],
                PointSize: range["@_PointSize"],
              });
            });
          } else if (typeof obj[key] === "object") {
            findCharacterRanges(obj[key], `${path}.${key}`);
          }
        });
      }
    };

    findCharacterRanges(storyData);
  }

  // ADD DEBUGGING FOR PARSED BR STRUCTURE
  debugBrElementsInParsedStructure(parsedData, path = "") {
    if (typeof parsedData === "object" && parsedData !== null) {
      Object.entries(parsedData).forEach(([key, value]) => {
        if (key === "Br") {
          console.log(`${path} has Br element:`, value);
        } else if (typeof value === "object" && value !== null) {
          this.debugBrElementsInParsedStructure(value, `${path}.${key}`);
        }
      });
    }
  }

  // CRITICAL FIX: Parse raw XML to preserve exact document order - FULLY DYNAMIC
  parseRawXMLForDocumentOrder(rawXMLContent, fileName) {
    console.log(`🔍 Parsing raw XML for document order: ${fileName}`);

    // DYNAMIC: Handle multiple CharacterStyleRange elements
    const charRangePattern =
      /<CharacterStyleRange[^>]*>(.*?)<\/CharacterStyleRange>/gs;
    const charRangeMatches = [...rawXMLContent.matchAll(charRangePattern)];

    if (charRangeMatches.length === 0) {
      console.log("❌ No CharacterStyleRange found in XML");
      return null;
    }

    console.log(
      `📄 Found ${charRangeMatches.length} CharacterStyleRange elements`
    );

    // DYNAMIC: Process all CharacterStyleRange elements
    const allDocumentOrder = [];

    charRangeMatches.forEach((match, rangeIndex) => {
      const charRangeContent = match[1];
      console.log(
        `📄 Processing CharacterStyleRange[${rangeIndex}]:`,
        charRangeContent.substring(0, 200) + "..."
      );

      // ENHANCED: More flexible pattern to handle different XML structures
      // Matches: <Content>text</Content>, <Content/>, <Br/>, <Br></Br>, <Br />
      const elementPattern =
        /<(Content|Br)(?:\s+[^>]*)?>([^<]*)<\/\1>|<(Content|Br)(?:\s+[^>]*)?\/?>|<(Content|Br)(?:\s+[^>]*)?>([^<]*)/g;

      let elementMatch;
      const rangeElements = [];

      while ((elementMatch = elementPattern.exec(charRangeContent)) !== null) {
        const elementType =
          elementMatch[1] || elementMatch[3] || elementMatch[4];
        const elementContent = elementMatch[2] || elementMatch[5] || "";

        if (elementType === "Content") {
          const contentText = elementContent.trim();
          if (contentText) {
            // Only add non-empty content
            rangeElements.push({
              type: "Content",
              text: contentText,
              rangeIndex: rangeIndex,
            });
            console.log(`📝 Found Content[${rangeIndex}]: "${contentText}"`);
          }
        } else if (elementType === "Br") {
          rangeElements.push({
            type: "Br",
            rangeIndex: rangeIndex,
          });
          console.log(`🔗 Found Br[${rangeIndex}]`);
        }
      }

      // Add range elements to overall document order
      allDocumentOrder.push(...rangeElements);
    });

    if (allDocumentOrder.length === 0) {
      console.log(
        "❌ No Content or Br elements found in any CharacterStyleRange"
      );
      return null;
    }

    // DYNAMIC: Analyze the break pattern for any structure
    const breakPattern = this.analyzeBreakPatternDynamic(allDocumentOrder);
    console.log("📊 Dynamic break pattern analysis:", breakPattern);

    // Store this for later use in processing
    this.documentOrderCache = this.documentOrderCache || {};
    this.documentOrderCache[fileName] = {
      documentOrder: allDocumentOrder,
      breakPattern: breakPattern,
      totalCharacterRanges: charRangeMatches.length,
    };

    return {
      documentOrder: allDocumentOrder,
      breakPattern: breakPattern,
      totalCharacterRanges: charRangeMatches.length,
    };
  }

  // DYNAMIC: Analyze break pattern for any document structure
  analyzeBreakPatternDynamic(documentOrder) {
    const pattern = [];
    let contentIndex = 0;

    for (let i = 0; i < documentOrder.length; i++) {
      const element = documentOrder[i];

      if (element.type === "Content") {
        // DYNAMIC: Count consecutive breaks after this content
        let breaksAfter = 0;
        let j = i + 1;

        // Count all consecutive Br elements following this Content
        while (j < documentOrder.length && documentOrder[j].type === "Br") {
          breaksAfter++;
          j++;
        }

        pattern.push({
          contentIndex: contentIndex,
          contentText: element.text,
          breaksAfter: breaksAfter,
          rangeIndex: element.rangeIndex,
          documentPosition: i,
        });

        console.log(
          `📋 Content[${contentIndex}] "${element.text}" has ${breaksAfter} breaks after it (doc pos: ${i})`
        );
        contentIndex++;
      }
    }

    // VALIDATION: Ensure pattern makes sense
    const totalContent = pattern.length;
    const totalBreaks = pattern.reduce((sum, p) => sum + p.breaksAfter, 0);

    console.log(
      `🔍 Pattern validation: ${totalContent} content items, ${totalBreaks} total breaks`
    );

    if (totalContent === 0) {
      console.log("⚠️ Warning: No content items found in pattern");
    }

    return pattern;
  }

  // IMPROVED: Merge adjacent character ranges that are part of the same word
  mergeAdjacentCharacterRanges(ranges, context) {
    if (ranges.length <= 1) return ranges;

    console.log(`🔧 Merging ${ranges.length} character ranges...`);
    console.log(
      `🔧 Original ranges:`,
      ranges.map((r, i) => ({
        index: i,
        content: this.extractContentFromRange(r),
        fillColor: r["@_FillColor"],
        paragraphStyle: r["@_AppliedParagraphStyle"],
      }))
    );

    const mergedRanges = [];
    let currentRange = { ...ranges[0] };
    let currentContent = this.extractContentFromRange(ranges[0]);

    for (let i = 1; i < ranges.length; i++) {
      const nextRange = ranges[i];
      const nextContent = this.extractContentFromRange(nextRange);

      console.log(`🔧 Checking merge: "${currentContent}" + "${nextContent}"`);

      // Check if these ranges should be merged
      const shouldMerge = this.shouldMergeCharacterRanges(
        currentRange,
        nextRange,
        currentContent,
        nextContent,
        context
      );

      if (shouldMerge) {
        console.log(
          `🔧 MERGING ranges ${
            i - 1
          } and ${i}: "${currentContent}" + "${nextContent}"`
        );

        // IMPROVED: Instead of merging content, preserve individual formatting
        // but mark them as a merged group to prevent space insertion
        currentRange._mergedGroup = currentRange._mergedGroup || [currentRange];
        currentRange._mergedGroup.push(nextRange);

        // Mark the next range to be skipped in space insertion
        nextRange._skipSpaceInsertion = true;

        // Don't actually merge the content - preserve formatting
        mergedRanges.push(currentRange);
        currentRange = { ...nextRange };
        currentContent = nextContent;
      } else {
        console.log(
          `🔧 NOT merging ranges ${
            i - 1
          } and ${i}: "${currentContent}" + "${nextContent}"`
        );
        // Don't merge, add current range and start new one
        mergedRanges.push(currentRange);
        currentRange = { ...nextRange };
        currentContent = nextContent;
      }
    }

    // Add the last range
    mergedRanges.push(currentRange);

    console.log(
      `🔧 Merged ${ranges.length} ranges into ${mergedRanges.length} ranges`
    );
    console.log(
      `🔧 Final merged ranges:`,
      mergedRanges.map((r, i) => ({
        index: i,
        content: this.extractContentFromRange(r),
        mergedGroup: r._mergedGroup ? r._mergedGroup.length : 0,
        fillColor: r["@_FillColor"],
        paragraphStyle: r["@_AppliedParagraphStyle"],
      }))
    );

    return mergedRanges;
  }

  // Helper method to extract content from a range
  extractContentFromRange(range) {
    if (!range.Content) return "";

    if (Array.isArray(range.Content)) {
      return range.Content.join("");
    }

    return String(range.Content);
  }

  // Determine if two character ranges should be merged
  shouldMergeCharacterRanges(
    currentRange,
    nextRange,
    currentContent,
    nextContent,
    context
  ) {
    // Don't merge if either range is empty
    if (!currentContent || !nextContent) return false;

    // Don't merge if there's a line break between them
    if (this.shouldInsertImplicitLineBreak(currentRange, nextRange, context))
      return false;

    // Don't merge if current content ends with whitespace
    if (/\s$/.test(currentContent)) return false;

    // Don't merge if next content starts with whitespace
    if (/^\s/.test(nextContent)) return false;

    // Don't merge if current content ends with punctuation
    if (/[.,;:!?)]$/.test(currentContent.trim())) return false;

    // Don't merge if next content starts with punctuation
    if (/^[.,;:!?(]/.test(nextContent.trim())) return false;

    // IMPROVED: Check if they form a complete word when combined
    const combinedText = currentContent.trim() + nextContent.trim();

    // Check if it's a single word (letters only)
    if (/^[a-zA-Z]+$/.test(combinedText)) return true;

    // Check for common words that might be split
    if (/^portfolio$/i.test(combinedText)) return true;

    // Check if they have the same paragraph style and similar formatting
    if (
      currentRange["@_AppliedParagraphStyle"] &&
      nextRange["@_AppliedParagraphStyle"] &&
      currentRange["@_AppliedParagraphStyle"] ===
        nextRange["@_AppliedParagraphStyle"] &&
      currentRange["@_PointSize"] === nextRange["@_PointSize"] &&
      currentRange["@_AppliedFont"] === nextRange["@_AppliedFont"]
    ) {
      // Additional check: if the combined text looks like a word, merge it
      if (/^[a-zA-Z]+$/.test(combinedText) || combinedText.length <= 12) {
        return true;
      }
    }

    return false;
  }

  getStories() {
    return this.stories;
  }

  getStory(storyId) {
    return this.stories[storyId];
  }

  clearStories() {
    this.stories = {};
  }
}

// ES6 exports
export default StoryParser;

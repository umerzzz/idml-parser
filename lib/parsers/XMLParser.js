import { XMLParser } from "fast-xml-parser";

class IDMLXMLParser {
  constructor() {
    // Critical parser configuration for IDML files
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      removeNSPrefix: true, // CRITICAL: Removes idPkg: prefixes
      parseAttributeValue: true, // Parse numbers and booleans
      trimValues: true,
      parseTrueNumberOnly: false,
      textNodeName: "#text",
    });
  }

  parse(xmlContent) {
    try {
      return this.xmlParser.parse(xmlContent);
    } catch (error) {
      console.error("Error parsing XML:", error);
      throw error;
    }
  }

  parseWithErrorHandling(xmlContent, fileName = "unknown") {
    try {
      const parsed = this.xmlParser.parse(xmlContent);
      return { success: true, data: parsed, error: null };
    } catch (error) {
      console.error(`Error parsing XML file ${fileName}:`, error.message);
      return { success: false, data: null, error: error.message };
    }
  }

  validateXMLStructure(xmlContent) {
    if (!xmlContent || typeof xmlContent !== "string") {
      return { valid: false, error: "Invalid XML content" };
    }

    if (!xmlContent.trim().startsWith("<")) {
      return { valid: false, error: "Content does not appear to be XML" };
    }

    try {
      this.xmlParser.parse(xmlContent);
      return { valid: true, error: null };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  extractRootElement(parsedXML) {
    if (!parsedXML || typeof parsedXML !== "object") {
      return null;
    }

    const keys = Object.keys(parsedXML);
    if (keys.length === 1) {
      return parsedXML[keys[0]];
    }

    return parsedXML;
  }

  findElementsByAttribute(obj, attributeName, attributeValue = null) {
    const results = [];

    const search = (current, path = "") => {
      if (typeof current === "object" && current !== null) {
        // Check if current object has the attribute
        if (current[attributeName] !== undefined) {
          if (
            attributeValue === null ||
            current[attributeName] === attributeValue
          ) {
            results.push({
              element: current,
              path: path,
              value: current[attributeName],
            });
          }
        }

        // Recursively search nested objects
        Object.keys(current).forEach((key) => {
          if (typeof current[key] === "object") {
            search(current[key], path ? `${path}.${key}` : key);
          }
        });
      }
    };

    search(obj);
    return results;
  }

  findElementsByType(obj, elementType) {
    const results = [];

    const search = (current, path = "") => {
      if (typeof current === "object" && current !== null) {
        // Check if we found the element type
        if (current[elementType]) {
          const elements = Array.isArray(current[elementType])
            ? current[elementType]
            : [current[elementType]];

          elements.forEach((element, index) => {
            results.push({
              element: element,
              path: `${path}.${elementType}[${index}]`,
              type: elementType,
            });
          });
        }

        // Continue searching in nested objects
        Object.keys(current).forEach((key) => {
          if (typeof current[key] === "object" && key !== elementType) {
            search(current[key], path ? `${path}.${key}` : key);
          }
        });
      }
    };

    search(obj);
    return results;
  }

  extractAllAttributes(obj, prefix = "@_") {
    const attributes = {};

    const extract = (current, path = "") => {
      if (typeof current === "object" && current !== null) {
        Object.keys(current).forEach((key) => {
          if (key.startsWith(prefix)) {
            const fullPath = path ? `${path}.${key}` : key;
            attributes[fullPath] = current[key];
          } else if (typeof current[key] === "object") {
            extract(current[key], path ? `${path}.${key}` : key);
          }
        });
      }
    };

    extract(obj);
    return attributes;
  }

  getElementHierarchy(obj, maxDepth = 5) {
    const hierarchy = {};

    const buildHierarchy = (current, depth = 0, path = "") => {
      if (
        depth >= maxDepth ||
        typeof current !== "object" ||
        current === null
      ) {
        return typeof current;
      }

      const structure = {};
      Object.keys(current).forEach((key) => {
        if (Array.isArray(current[key])) {
          structure[key] = {
            type: "array",
            length: current[key].length,
            children:
              current[key].length > 0
                ? buildHierarchy(
                    current[key][0],
                    depth + 1,
                    `${path}.${key}[0]`
                  )
                : null,
          };
        } else if (typeof current[key] === "object" && current[key] !== null) {
          structure[key] = {
            type: "object",
            children: buildHierarchy(current[key], depth + 1, `${path}.${key}`),
          };
        } else {
          structure[key] = {
            type: typeof current[key],
            value: key.startsWith("@_") ? current[key] : null,
          };
        }
      });

      return structure;
    };

    return buildHierarchy(obj);
  }

  normalizeXMLContent(xmlContent) {
    return xmlContent.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  }

  logXMLStructure(parsedXML, maxDepth = 3) {
    console.log("XML Structure Analysis:");

    const analyzeStructure = (obj, depth = 0, prefix = "") => {
      if (depth >= maxDepth || typeof obj !== "object" || obj === null) {
        return;
      }

      Object.keys(obj).forEach((key) => {
        const value = obj[key];
        const indent = "  ".repeat(depth);

        if (Array.isArray(value)) {
          console.log(`${indent}${prefix}${key}: Array[${value.length}]`);
          if (value.length > 0 && typeof value[0] === "object") {
            analyzeStructure(value[0], depth + 1, `${prefix}${key}[0].`);
          }
        } else if (typeof value === "object" && value !== null) {
          console.log(`${indent}${prefix}${key}: Object`);
          analyzeStructure(value, depth + 1, `${prefix}${key}.`);
        } else if (key.startsWith("@_")) {
          console.log(`${indent}${prefix}${key}: ${typeof value} = ${value}`);
        } else {
          console.log(`${indent}${prefix}${key}: ${typeof value}`);
        }
      });
    };

    analyzeStructure(parsedXML);
  }
}

// ES6 exports
export default IDMLXMLParser;

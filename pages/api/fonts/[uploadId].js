import path from "path";
import fs from "fs";

/**
 * API endpoint to get Next.js font information for a specific upload
 * GET /api/fonts/[uploadId]
 *
 * Returns:
 * - Font mappings from IDML to Next.js fonts
 * - Import statements for Next.js fonts
 * - CSS variables and usage examples
 * - Complete implementation guide
 */
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { uploadId } = req.query;

    if (!uploadId) {
      return res.status(400).json({ error: "Upload ID is required" });
    }

    // Define paths
    const uploadDir = path.join(process.cwd(), "uploads", uploadId);
    const processedDataPath = path.join(uploadDir, "processed_data.json");

    // Check if processed data exists
    if (!fs.existsSync(processedDataPath)) {
      return res.status(404).json({
        error: "Processed data not found",
        suggestion:
          "Make sure the file has been uploaded and processed successfully",
      });
    }

    // Read processed data
    const processedData = JSON.parse(
      fs.readFileSync(processedDataPath, "utf-8")
    );

    // Check if Next.js fonts were processed
    if (!processedData.nextFonts) {
      return res.status(200).json({
        message: "No Next.js font data available",
        suggestion:
          "The document may have been processed before Next.js font mapping was enabled. Please re-upload your file for automatic font processing.",
        availableFonts: extractAvailableFonts(processedData),
        reprocessingRequired: true,
        note: "Starting with the latest version, font processing happens automatically during upload.",
      });
    }

    // Return comprehensive font information
    res.status(200).json({
      success: true,
      uploadId: uploadId,
      fontInfo: {
        summary: {
          totalFonts: processedData.nextFonts.totalFonts,
          uniqueNextFonts: processedData.nextFonts.usedFontNames.length,
          googleFonts: processedData.nextFonts.usedFonts.filter(
            (f) => f.isGoogleFont
          ).length,
          systemFonts: processedData.nextFonts.usedFonts.filter(
            (f) => f.isSystemFont
          ).length,
        },

        // All mapped fonts with details
        fonts: processedData.nextFonts.usedFonts,

        // Ready-to-use code snippets
        implementation: {
          // Next.js imports
          imports: processedData.nextFonts.imports,

          // Font variable definitions
          variables: processedData.nextFonts.variables,

          // CSS variables
          cssVariables: processedData.nextFonts.cssVariables,

          // Usage examples
          examples: {
            ...processedData.nextFonts.examples,
            // Additional usage patterns
            reactComponent: generateReactExample(
              processedData.nextFonts.usedFonts[0]
            ),
            cssModule: generateCSSExample(processedData.nextFonts.usedFonts[0]),
            tailwindConfig: generateTailwindExample(
              processedData.nextFonts.usedFonts
            ),
          },
        },

        // Step-by-step guide
        guide: {
          ...processedData.nextFonts.implementation,
          detailedSteps: [
            {
              step: 1,
              title: "Install and Import Fonts",
              description: "Add these imports to your page or layout component",
              code: processedData.nextFonts.imports,
              file: "_app.js or layout.js",
            },
            {
              step: 2,
              title: "Initialize Font Variables",
              description: "Define font configurations with weights and styles",
              code: processedData.nextFonts.variables,
              file: "_app.js or layout.js",
            },
            {
              step: 3,
              title: "Apply Fonts in Components",
              description: "Use className or CSS variables to apply fonts",
              code: generateUsageExamples(processedData.nextFonts.usedFonts),
              file: "Your components",
            },
            {
              step: 4,
              title: "Configure CSS Variables (Optional)",
              description: "Add to your global CSS for easier usage",
              code: `:root {\n  ${processedData.nextFonts.cssVariables}\n}`,
              file: "globals.css",
            },
          ],
        },

        // Font mapping details
        mappings: processedData.nextFonts.usedFonts.map((font) => ({
          original: font.originalFamily,
          nextJs: font.fontFamily,
          nextFontName: font.nextFont,
          category: font.category,
          weights: font.fontWeight,
          style: font.fontStyle,
          isGoogleFont: font.isGoogleFont,
          fallbacks: font.fontFamilyFallback,
        })),
      },
    });
  } catch (error) {
    console.error("Error fetching font information:", error);
    res.status(500).json({
      error: "Failed to fetch font information",
      details: error.message,
    });
  }
}

/**
 * Extract available fonts from processed data for reprocessing suggestion
 */
function extractAvailableFonts(processedData) {
  const fonts = new Set();

  // Extract from stories
  if (processedData.stories) {
    Object.values(processedData.stories).forEach((story) => {
      if (story.formattedContent) {
        story.formattedContent.forEach((segment) => {
          if (segment.formatting && segment.formatting.fontFamily) {
            fonts.add(segment.formatting.fontFamily);
          }
        });
      }
    });
  }

  // Extract from resources
  if (processedData.resources && processedData.resources.fonts) {
    Object.values(processedData.resources.fonts).forEach((fontFamily) => {
      if (fontFamily.name) {
        fonts.add(fontFamily.name);
      }
    });
  }

  return Array.from(fonts);
}

/**
 * Generate React component example
 */
function generateReactExample(font) {
  if (!font) return "";

  return `// React Component Example
import { ${font.nextFont} } from 'next/font/google';

const ${font.nextFont.toLowerCase()} = ${font.nextFont}({
  weight: '${font.fontWeight}',
  subsets: ['latin'],
});

export default function MyComponent() {
  return (
    <div className={\`\${${font.nextFont.toLowerCase()}.className} text-lg\`}>
      Your text with ${font.fontFamily}
    </div>
  );
}`;
}

/**
 * Generate CSS module example
 */
function generateCSSExample(font) {
  if (!font) return "";

  return `/* CSS Module Example - styles.module.css */
.text {
  font-family: var(${font.nextFontVariable}), ${font.fontFamilyFallback};
  font-size: ${font.fontSize};
  font-weight: ${font.fontWeight};
  font-style: ${font.fontStyle};
}

/* Usage in component */
import styles from './styles.module.css';
<div className={styles.text}>Your text here</div>`;
}

/**
 * Generate Tailwind CSS configuration example
 */
function generateTailwindExample(fonts) {
  if (!fonts || fonts.length === 0) return "";

  const fontFamilies = fonts
    .map(
      (font) =>
        `        '${font.fontFamily
          .toLowerCase()
          .replace(/\s+/g, "-")}': ['var(${
          font.nextFontVariable
        })', ...defaultTheme.fontFamily.${
          font.category === "serif"
            ? "serif"
            : font.category === "monospace"
            ? "mono"
            : "sans"
        }]`
    )
    .join(",\n");

  return `// tailwind.config.js
const { fontFamily } = require('tailwindcss/defaultTheme');

module.exports = {
  theme: {
    extend: {
      fontFamily: {
${fontFamilies}
      }
    }
  }
};

// Usage: <div className="font-${fonts[0].fontFamily
    .toLowerCase()
    .replace(/\s+/g, "-")}">Text</div>`;
}

/**
 * Generate comprehensive usage examples
 */
function generateUsageExamples(fonts) {
  if (!fonts || fonts.length === 0) return "";

  const examples = fonts
    .slice(0, 3)
    .map(
      (font, index) => `
// Method ${index + 1}: Using className
<div className={\`\${${font.nextFont.toLowerCase()}.className} text-lg\`}>
  Text with ${font.fontFamily}
</div>

// Method ${index + 2}: Using CSS variable
<div style={{ fontFamily: 'var(${font.nextFontVariable})' }}>
  Text with ${font.fontFamily}
</div>`
    )
    .join("\n");

  return `// Font Usage Examples${examples}

// Method: Using with Tailwind (after config)
<div className="font-${fonts[0].fontFamily
    .toLowerCase()
    .replace(/\s+/g, "-")} text-xl">
  Styled text
</div>`;
}

# Oregon Tax Table Updater

A desktop application to extract tax tables from screenshots and automatically update JSON files for the Oregon tax system.

## Features

✅ **Upload Screenshots** - Support for multiple image formats (JPG, PNG, BMP, GIF)  
✅ **Extract Tax Data** - Processes images and extracts tax table values  
✅ **Review Data** - Preview extracted data before updating  
✅ **Export to Text** - Save tax tables as structured text files  
✅ **Automatic JSON Update** - Updates both Single and Joint JSON files automatically  

## Installation

### Prerequisites
- Node.js (v16 or higher)
- npm (comes with Node.js)

### Steps

1. **Extract the application folder** to your desired location

2. **Open Command Prompt or Terminal** in the application folder

3. **Install dependencies:**
   ```bash
   npm install
   ```

## Usage

### Running the Application

```bash
npm start
```

### Step-by-Step Guide

1. **Upload Tax Table Screenshots**
   - Click "Select Images" button
   - Choose 1-3 screenshots of Oregon tax table pages
   - Images will appear in the preview area

2. **Extract Tax Table Data**
   - Click "Extract Data from Images" button
   - Wait for the extraction process to complete
   - Progress bar will show the status

3. **Review Extracted Data**
   - Check the data preview section
   - Verify the extraction summary shows correct information
   - Optionally export as text file for your records

4. **Update JSON Files**
   - Click "Select Single JSON" and choose the Single filer JSON file
   - Click "Select Joint JSON" and choose the Joint filer JSON file
   - Click "Update Both JSON Files" button
   - Success message will appear when complete

## File Locations

The application defaults to the following files, but you can select different file locations in the UI:

**Single Filers:**  
`C:\TaxEngine\OCE-Regulatory-2025\Source\OR\Utils\Tables\TaxTableForSingle.table.json`

**Joint Filers:**  
`C:\TaxEngine\OCE-Regulatory-2025\Source\OR\Utils\Tables\TaxTableForJoint.table.json`

## Building for Distribution

To create a standalone executable:

```bash
npm run build
```

The executable will be created in the `dist` folder.

## Technical Details

- **Framework:** Electron
- **Tax Year:** 2024
- **Income Range:** $0 - $49,900
- **Data Points:** 500+ tax brackets

## Troubleshooting

**Images not loading?**
- Ensure images are in a supported format (JPG, PNG, BMP, GIF)
- Check that files are not corrupted

**JSON files not updating?**
- Verify the file paths exist on your system
- Check that you have write permissions to the directories
- Make sure the JSON files have the correct structure

**Application won't start?**
- Ensure Node.js is installed correctly
- Run `npm install` again to reinstall dependencies
- Check for error messages in the console

## Support

For issues or questions, please check:
1. This README file
2. The troubleshooting section above
3. Node.js and Electron documentation

## Version

Current Version: 1.0.1  
Tax Year: 2024

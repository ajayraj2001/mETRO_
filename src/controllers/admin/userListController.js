const asyncHandler = require("../../utils/asyncHandler");
const { ApiError } = require("../../errorHandler");
const { User } = require("../../models");
const ExcelJS = require('exceljs');

const getAllUsers = asyncHandler(async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const startDate = req.query.startDate ? new Date(req.query.startDate) : null;
    const endDate = req.query.endDate ? new Date(req.query.endDate) : null;
    const sortBy = req.query.sortBy || 'created_at';
    const sortOrder = req.query.sortOrder === 'desc' ? -1 : 1;

    // Build the search query
    const searchQuery = {
      $or: [
        { fullName: { $regex: search, $options: 'i' } }, // Case-insensitive search by name
        { phone: { $regex: search, $options: 'i' } }, // Case-insensitive search by number
      ],
    };

    // Add date filter if provided
    if (startDate && endDate) {
      searchQuery.$and = searchQuery.$and || []; // Ensure $and array exists before using push
      searchQuery.$and.push({
        created_at: {
          $gte: startDate || new Date(0),
          $lte: endDate ? new Date(new Date(endDate).setUTCHours(23, 59, 59, 999)) : new Date(),
        },
      });
    }

    const totalUsers = await User.countDocuments(searchQuery);

    const users = await User.find(searchQuery)
      .sort({ [sortBy]: sortOrder })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('-location -otp -otp_expiry -updated_at');

    // Pagination metadata
    const pagination = {
      currentPage: page,
      totalPages: Math.ceil(totalUsers / limit),
      totalUsers,
    };

    return res.status(200).json({
      success: true,
      message: "Users fetched successfully",
      data: users,
      pagination,
    });
  } catch (error) {
    console.log('error', error);
    next(error);
  }
});

const deleteUser = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const user = await User.findByIdAndDelete(id);

  if (!user) {
    return next(new ApiError('User not found', 404));
  }

  return res.status(200).json({
    success: true,
    message: 'User deleted successfully',
  });
});

const updateUserStatus = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { active } = req.body;

  if (typeof active !== 'boolean') {
    return next(new ApiError('Invalid active status provided. Must be true or false.', 400));
  }

  const user = await User.findByIdAndUpdate(
    id,
    { active },
    { new: true }
  );

  if (!user) {
    return next(new ApiError('User not found', 404));
  }

  return res.status(200).json({
    success: true,
    message: `User has been ${active ? 'activated' : 'deactivated'} successfully`,
    data: {
      _id: user._id,
      fullName: user.fullName,
      phone: user.phone,
      active: user.active,
    }
  });
});

/**
 * Export users to Excel with filtering and sorting options
 * GET /api/admin/users/export
 * 
 * Query Parameters:
 * - dateFrom: Start date (YYYY-MM-DD)
 * - dateTo: End date (YYYY-MM-DD)
 * - sortBy: 'newest' | 'oldest' (default: 'newest')
 * - limit: Maximum number of records (default: 10000, max: 50000)
 */
const exportUsers = asyncHandler(async (req, res, next) => {
  const { dateFrom, dateTo, sortBy = 'newest', limit = 10000 } = req.query;
  
  // Validate limit to prevent server overload
  const maxLimit = Math.min(parseInt(limit) || 10000, 50000);
  
  // Build query filter
  const filter = { permanentlyDeleted: { $ne: true } };
  
  // Add date filter if provided
  if (dateFrom || dateTo) {
    filter.created_at = {};
    
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      if (isNaN(fromDate.getTime())) {
        return next(new ApiError('Invalid dateFrom format. Use YYYY-MM-DD', 400));
      }
      fromDate.setHours(0, 0, 0, 0);
      filter.created_at.$gte = fromDate;
    }
    
    if (dateTo) {
      const toDate = new Date(dateTo);
      if (isNaN(toDate.getTime())) {
        return next(new ApiError('Invalid dateTo format. Use YYYY-MM-DD', 400));
      }
      toDate.setHours(23, 59, 59, 999);
      filter.created_at.$lte = toDate;
    }
  }
  
  // Validate sortBy parameter
  if (!['newest', 'oldest'].includes(sortBy)) {
    return next(new ApiError('Invalid sortBy parameter. Use "newest" or "oldest"', 400));
  }
  
  // Determine sort order
  const sortOrder = sortBy === 'oldest' ? 1 : -1;
  
  // Fields to exclude from export
  const excludeFields = {
    min_salary: 0,
    max_salary: 0,
    heightInCm: 0,
    description: 0,
    deviceId: 0,
    deviceToken: 0,
    birthplace: 0,
    birth_long: 0,
    birth_lat: 0,
    birth_time: 0,
    location: 0,
    otp: 0,
    otp_expiry: 0,
    __v: 0
  };
  
  // Stream processing for large datasets
  const users = await User.find(filter, excludeFields)
    .sort({ created_at: sortOrder })
    .limit(maxLimit)
    .lean() // Use lean() for better performance
    .exec();

  if (!users || users.length === 0) {
    return next(new ApiError('No users found for the specified criteria', 404));
  }
  
  // Create Excel workbook
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Users Export');
  
  // Define columns with proper headers
  const columns = [
    { header: 'Profile ID', key: 'profileId', width: 15 },
    { header: 'Full Name', key: 'fullName', width: 20 },
    { header: 'Email', key: 'email', width: 25 },
    { header: 'Phone', key: 'phone', width: 15 },
    { header: 'Profile For', key: 'profile_for', width: 15 },
    { header: 'Source', key: 'source', width: 10 },
    { header: 'Active', key: 'active', width: 10 },
    { header: 'Date of Birth', key: 'dob', width: 15 },
    { header: 'Gender', key: 'gender', width: 10 },
    { header: 'Like Count', key: 'likeCount', width: 12 },
    { header: 'Marital Status', key: 'marital_status', width: 15 },
    { header: 'Height', key: 'height', width: 10 },
    { header: 'Country', key: 'country', width: 15 },
    { header: 'State', key: 'state', width: 15 },
    { header: 'State Code', key: 'stateCode', width: 12 },
    { header: 'City', key: 'city', width: 15 },
    { header: 'Annual Income', key: 'annual_income', width: 15 },
    { header: 'Employed In', key: 'employed_in', width: 15 },
    { header: 'Highest Education', key: 'highest_education', width: 20 },
    { header: 'Course', key: 'course', width: 20 },
    { header: 'Occupation', key: 'occupation', width: 20 },
    { header: 'Mother Tongue', key: 'mother_tongue', width: 15 },
    { header: 'Religion', key: 'religion', width: 15 },
    { header: 'Sect', key: 'sect', width: 15 },
    { header: 'Jammat', key: 'jammat', width: 15 },
    { header: 'Caste', key: 'caste', width: 15 },
    { header: 'Thoughts on Horoscope', key: 'thoughts_on_horoscope', width: 20 },
    { header: 'Manglik', key: 'manglik', width: 10 },
    { header: 'Profile Status', key: 'profileStatus', width: 15 },
    { header: 'Preference Status', key: 'preferenceStatus', width: 18 },
    { header: 'Living with Family', key: 'living_with_family', width: 18 },
    { header: 'Diet', key: 'diet', width: 15 },
    { header: 'Profile Images', key: 'profile_image', width: 30 },
    { header: 'Created At', key: 'created_at', width: 20 },
    { header: 'Updated At', key: 'updated_at', width: 20 }
  ];
  
  worksheet.columns = columns;
  
  // Style the header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '4472C4' }
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  
  // Process users in batches to avoid memory issues
  const batchSize = 1000;
  let currentRow = 2;
  
  for (let i = 0; i < users.length; i += batchSize) {
    const batch = users.slice(i, i + batchSize);
    
    batch.forEach(user => {
      const row = worksheet.getRow(currentRow);
      
      // Format data for Excel
      const rowData = {
        profileId: user.profileId || '',
        fullName: user.fullName || '',
        email: user.email || '',
        phone: user.phone || '',
        profile_for: user.profile_for || '',
        source: user.source || '',
        active: user.active ? 'Yes' : 'No',
        dob: user.dob ? new Date(user.dob).toLocaleDateString() : '',
        gender: user.gender || '',
        likeCount: user.likeCount || 0,
        marital_status: user.marital_status || '',
        height: user.height || '',
        country: user.country || '',
        state: user.state || '',
        stateCode: user.stateCode || '',
        city: user.city || '',
        annual_income: user.annual_income || '',
        employed_in: user.employed_in || '',
        highest_education: user.highest_education || '',
        course: user.course || '',
        occupation: user.occupation || '',
        mother_tongue: user.mother_tongue || '',
        religion: user.religion || '',
        sect: user.sect || '',
        jammat: user.jammat || '',
        caste: user.caste || '',
        thoughts_on_horoscope: user.thoughts_on_horoscope || '',
        manglik: user.manglik || '',
        profileStatus: user.profileStatus || '',
        preferenceStatus: user.preferenceStatus || '',
        living_with_family: user.living_with_family || '',
        diet: user.diet || '',
        profile_image: Array.isArray(user.profile_image) ? user.profile_image.join(', ') : (user.profile_image || ''),
        created_at: user.created_at ? new Date(user.created_at).toLocaleString() : '',
        updated_at: user.updated_at ? new Date(user.updated_at).toLocaleString() : ''
      };
      
      row.values = Object.values(rowData);
      currentRow++;
    });
  }
  
  // Auto-fit columns
  worksheet.columns.forEach(column => {
    if (column.width < 10) column.width = 10;
    if (column.width > 50) column.width = 50;
  });
  
  // Generate filename with timestamp and filters
  const timestamp = new Date().toISOString().split('T')[0];
  let filename = `users_export_${timestamp}`;
  
  if (dateFrom && dateTo) {
    filename += `_${dateFrom}_to_${dateTo}`;
  } else if (dateFrom) {
    filename += `_from_${dateFrom}`;
  } else if (dateTo) {
    filename += `_until_${dateTo}`;
  }
  
  filename += `_${sortBy}.xlsx`;
  
  // Set response headers
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  // Write workbook to response
  await workbook.xlsx.write(res);
  res.end();
});

// const exportUsers = asyncHandler(async (req, res, next) => {
//   const { 
//     dateFrom, 
//     dateTo, 
//     sortBy = 'newest', 
//     excludeFields = [] // ADDED: Array of fields to exclude from export
//   } = req.query;
  
//   // REMOVED: limit parameter and maxLimit validation - now exports ALL data
  
//   // Build query filter
//   const filter = { permanentlyDeleted: { $ne: true } };
  
//   // Add date filter if provided
//   if (dateFrom || dateTo) {
//     filter.created_at = {};
    
//     if (dateFrom) {
//       const fromDate = new Date(dateFrom);
//       if (isNaN(fromDate.getTime())) {
//         return next(new ApiError('Invalid dateFrom format. Use YYYY-MM-DD', 400));
//       }
//       fromDate.setHours(0, 0, 0, 0);
//       filter.created_at.$gte = fromDate;
//     }
    
//     if (dateTo) {
//       const toDate = new Date(dateTo);
//       if (isNaN(toDate.getTime())) {
//         return next(new ApiError('Invalid dateTo format. Use YYYY-MM-DD', 400));
//       }
//       toDate.setHours(23, 59, 59, 999);
//       filter.created_at.$lte = toDate;
//     }
//   }
  
//   // Validate sortBy parameter
//   if (!['newest', 'oldest'].includes(sortBy)) {
//     return next(new ApiError('Invalid sortBy parameter. Use "newest" or "oldest"', 400));
//   }
  
//   // Determine sort order
//   const sortOrder = sortBy === 'oldest' ? 1 : -1;
  
//   // UPDATED: Always excluded fields (sensitive/internal data) - these cannot be selected by user
//   const alwaysExcludeFields = {
//     otp: 0,
//     otp_expiry: 0,
//     deviceId: 0,
//     deviceToken: 0,
//     __v: 0,
//     permanentlyDeleted: 0,
//     // Add other sensitive fields here that should never be exported
//   };
  
//   // ADDED: Dynamic field exclusion based on user selection
//   const userExcludeFields = {};
//   if (Array.isArray(excludeFields)) {
//     excludeFields.forEach(field => {
//       // Don't allow exclusion of always-excluded sensitive fields
//       if (!alwaysExcludeFields.hasOwnProperty(field)) {
//         userExcludeFields[field] = 0;
//       }
//     });
//   } else if (typeof excludeFields === 'string') {
//     // Handle comma-separated string of field names
//     const fieldsArray = excludeFields.split(',').map(field => field.trim());
//     fieldsArray.forEach(field => {
//       if (!alwaysExcludeFields.hasOwnProperty(field)) {
//         userExcludeFields[field] = 0;
//       }
//     });
//   }
  
//   // Combine always excluded fields with user selected exclusions
//   const finalExcludeFields = { ...alwaysExcludeFields, ...userExcludeFields };
  
//   // UPDATED: Remove limit and use cursor-based approach for better memory management
//   console.log('Starting user export...'); // Log for monitoring
  
//   const users = await User.find(filter, finalExcludeFields)
//     .sort({ created_at: sortOrder })
//     .lean() // Use lean() for better performance
//     .exec();
  
//   console.log(`Found ${users.length} users to export`); // Log for monitoring
  
//   if (!users || users.length === 0) {
//     return next(new ApiError('No users found for the specified criteria', 404));
//   }
  
//   // Create Excel workbook
//   const workbook = new ExcelJS.Workbook();
//   const worksheet = workbook.addWorksheet('Users Export');
  
//   // UPDATED: Dynamic column definition based on available fields (excluding user-selected exclusions)
//   const availableColumns = [
//     { field: 'profileId', header: 'Profile ID', width: 15 },
//     { field: 'fullName', header: 'Full Name', width: 20 },
//     { field: 'email', header: 'Email', width: 25 },
//     { field: 'phone', header: 'Phone', width: 15 },
//     { field: 'profile_for', header: 'Profile For', width: 15 },
//     { field: 'source', header: 'Source', width: 10 },
//     { field: 'active', header: 'Active', width: 10 },
//     { field: 'dob', header: 'Date of Birth', width: 15 },
//     { field: 'gender', header: 'Gender', width: 10 },
//     { field: 'likeCount', header: 'Like Count', width: 12 },
//     { field: 'marital_status', header: 'Marital Status', width: 15 },
//     { field: 'height', header: 'Height', width: 10 },
//     { field: 'heightInCm', header: 'Height (cm)', width: 12 }, // Made dynamic
//     { field: 'country', header: 'Country', width: 15 },
//     { field: 'state', header: 'State', width: 15 },
//     { field: 'stateCode', header: 'State Code', width: 12 },
//     { field: 'city', header: 'City', width: 15 },
//     { field: 'annual_income', header: 'Annual Income', width: 15 },
//     { field: 'min_salary', header: 'Min Salary', width: 15 }, // Made dynamic
//     { field: 'max_salary', header: 'Max Salary', width: 15 }, // Made dynamic
//     { field: 'employed_in', header: 'Employed In', width: 15 },
//     { field: 'highest_education', header: 'Highest Education', width: 20 },
//     { field: 'course', header: 'Course', width: 20 },
//     { field: 'occupation', header: 'Occupation', width: 20 },
//     { field: 'mother_tongue', header: 'Mother Tongue', width: 15 },
//     { field: 'religion', header: 'Religion', width: 15 },
//     { field: 'sect', header: 'Sect', width: 15 },
//     { field: 'jammat', header: 'Jammat', width: 15 },
//     { field: 'caste', header: 'Caste', width: 15 },
//     { field: 'thoughts_on_horoscope', header: 'Thoughts on Horoscope', width: 20 },
//     { field: 'manglik', header: 'Manglik', width: 10 },
//     { field: 'profileStatus', header: 'Profile Status', width: 15 },
//     { field: 'preferenceStatus', header: 'Preference Status', width: 18 },
//     { field: 'living_with_family', header: 'Living with Family', width: 18 },
//     { field: 'diet', header: 'Diet', width: 15 },
//     { field: 'description', header: 'Description', width: 30 }, // Made dynamic
//     { field: 'birthplace', header: 'Birthplace', width: 20 }, // Made dynamic
//     { field: 'birth_long', header: 'Birth Longitude', width: 15 }, // Made dynamic
//     { field: 'birth_lat', header: 'Birth Latitude', width: 15 }, // Made dynamic
//     { field: 'birth_time', header: 'Birth Time', width: 15 }, // Made dynamic
//     { field: 'location', header: 'Location', width: 20 }, // Made dynamic
//     { field: 'profile_image', header: 'Profile Images', width: 30 },
//     { field: 'created_at', header: 'Created At', width: 20 },
//     { field: 'updated_at', header: 'Updated At', width: 20 }
//   ];
  
//   // ADDED: Filter columns based on user exclusions
//   const filteredColumns = availableColumns.filter(col => 
//     !finalExcludeFields.hasOwnProperty(col.field)
//   );
  
//   // Set up worksheet columns
//   worksheet.columns = filteredColumns.map(col => ({
//     header: col.header,
//     key: col.field,
//     width: col.width
//   }));
  
//   // Style the header row
//   const headerRow = worksheet.getRow(1);
//   headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
//   headerRow.fill = {
//     type: 'pattern',
//     pattern: 'solid',
//     fgColor: { argb: '4472C4' }
//   };
//   headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  
//   // UPDATED: Process users in larger batches for better performance with no limit
//   const batchSize = 5000; // Increased batch size
//   let currentRow = 2;
  
//   console.log('Processing user data in batches...'); // Log for monitoring
  
//   for (let i = 0; i < users.length; i += batchSize) {
//     const batch = users.slice(i, i + batchSize);
//     console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(users.length/batchSize)}`); // Progress log
    
//     batch.forEach(user => {
//       const row = worksheet.getRow(currentRow);
      
//       // UPDATED: Dynamic row data based on filtered columns
//       const rowData = {};
      
//       filteredColumns.forEach(col => {
//         const field = col.field;
//         let value = user[field];
        
//         // Format specific field types
//         switch (field) {
//           case 'active':
//             rowData[field] = value ? 'Yes' : 'No';
//             break;
//           case 'dob':
//             rowData[field] = value ? new Date(value).toLocaleDateString() : '';
//             break;
//           case 'profile_image':
//             rowData[field] = Array.isArray(value) ? value.join(', ') : (value || '');
//             break;
//           case 'created_at':
//           case 'updated_at':
//             rowData[field] = value ? new Date(value).toLocaleString() : '';
//             break;
//           case 'birth_time':
//             rowData[field] = value ? new Date(value).toLocaleTimeString() : '';
//             break;
//           default:
//             rowData[field] = value || '';
//         }
//       });
      
//       row.values = Object.values(rowData);
//       currentRow++;
//     });
    
//     // Optional: Add small delay between batches to prevent memory spikes
//     if (i + batchSize < users.length) {
//       await new Promise(resolve => setTimeout(resolve, 10));
//     }
//   }
  
//   console.log('User data processing completed'); // Log for monitoring
  
//   // Auto-fit columns
//   worksheet.columns.forEach(column => {
//     if (column.width < 10) column.width = 10;
//     if (column.width > 50) column.width = 50;
//   });
  
//   // UPDATED: Generate filename with user count and filters
//   const timestamp = new Date().toISOString().split('T')[0];
//   let filename = `users_export_${users.length}_records_${timestamp}`;
  
//   if (dateFrom && dateTo) {
//     filename += `_${dateFrom}_to_${dateTo}`;
//   } else if (dateFrom) {
//     filename += `_from_${dateFrom}`;
//   } else if (dateTo) {
//     filename += `_until_${dateTo}`;
//   }
  
//   filename += `_${sortBy}.xlsx`;
  
//   // Set response headers
//   res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
//   res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
//   res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
//   res.setHeader('Pragma', 'no-cache');
//   res.setHeader('Expires', '0');
  
//   console.log(`Starting Excel file generation for ${users.length} users...`); // Log for monitoring
  
//   // Write workbook to response
//   await workbook.xlsx.write(res);
//   console.log('Excel export completed successfully'); // Log for monitoring
//   res.end();
// });

/**
 * Get export statistics (for UI display)
 * GET /api/admin/users/export-stats
 */
const getExportStats = asyncHandler(async (req, res, next) => {
  const { dateFrom, dateTo } = req.query;
  
  // Build query filter
  const filter = { permanentlyDeleted: { $ne: true } };
  
  // Add date filter if provided
  if (dateFrom || dateTo) {
    filter.created_at = {};
    
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      if (isNaN(fromDate.getTime())) {
        return next(new ApiError('Invalid dateFrom format. Use YYYY-MM-DD', 400));
      }
      fromDate.setHours(0, 0, 0, 0);
      filter.created_at.$gte = fromDate;
    }
    
    if (dateTo) {
      const toDate = new Date(dateTo);
      if (isNaN(toDate.getTime())) {
        return next(new ApiError('Invalid dateTo format. Use YYYY-MM-DD', 400));
      }
      toDate.setHours(23, 59, 59, 999);
      filter.created_at.$lte = toDate;
    }
  }
  
  const totalUsers = await User.countDocuments(filter);
  const activeUsers = await User.countDocuments({ ...filter, active: true });
  const inactiveUsers = await User.countDocuments({ ...filter, active: false });
  
  return res.status(200).json({
    success: true,
    data: {
      totalUsers,
      activeUsers,
      inactiveUsers,
      filters: {
        dateFrom: dateFrom || null,
        dateTo: dateTo || null
      }
    }
  });
});

module.exports = {
  getAllUsers,
  deleteUser,
  exportUsers,
  getExportStats,
  updateUserStatus
};

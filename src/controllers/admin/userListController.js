const asyncHandler = require("../../utils/asyncHandler");
const { ApiError } = require("../../errorHandler");
const { User } = require("../../models");
const ExcelJS = require('exceljs');

const getAllUsers = asyncHandler(async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      startDate,
      endDate,
      sortBy = 'created_at',
      sortOrder = 'asc',
      profileId
    } = req.query;

   // If profileId is provided, return user as array
    if (profileId) {
      const user = await User.findOne({ profileId }).select('-location -otp -otp_expiry -updated_at');

      return res.status(200).json({
        success: true,
        message: user ? "User fetched successfully" : "User not found with provided profileId",
        data: user ? [user] : [],
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalUsers: user ? 1 : 0,
        }
      });
    }

    // Normal search flow
    const sortDir = sortOrder === 'desc' ? -1 : 1;

    const query = {
      $or: [
        { fullName: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ]
    };

    if (startDate && endDate) {
      query.$and = query.$and || [];
      query.$and.push({
        created_at: {
          $gte: new Date(startDate),
          $lte: new Date(new Date(endDate).setUTCHours(23, 59, 59, 999)),
        }
      });
    }

    const totalUsers = await User.countDocuments(query);

    const users = await User.find(query)
      .sort({ [sortBy]: sortDir })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .select('-location -otp -otp_expiry -updated_at');

    const pagination = {
      currentPage: parseInt(page),
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
// const exportUsers = asyncHandler(async (req, res, next) => {
//   const { dateFrom, dateTo, sortBy = 'newest', limit = 10000 } = req.query;
  
//   // Validate limit to prevent server overload
//   const maxLimit = Math.min(parseInt(limit) || 10000, 50000);
  
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
  
//   // Fields to exclude from export
//   const excludeFields = {
//     min_salary: 0,
//     max_salary: 0,
//     heightInCm: 0,
//     description: 0,
//     deviceId: 0,
//     deviceToken: 0,
//     birthplace: 0,
//     birth_long: 0,
//     birth_lat: 0,
//     birth_time: 0,
//     location: 0,
//     otp: 0,
//     otp_expiry: 0,
//     __v: 0
//   };
  
//   // Stream processing for large datasets
//   const users = await User.find(filter, excludeFields)
//     .sort({ created_at: sortOrder })
//     .limit(maxLimit)
//     .lean() // Use lean() for better performance
//     .exec();

//   if (!users || users.length === 0) {
//     return next(new ApiError('No users found for the specified criteria', 404));
//   }
  
//   // Create Excel workbook
//   const workbook = new ExcelJS.Workbook();
//   const worksheet = workbook.addWorksheet('Users Export');
  
//   // Define columns with proper headers
//   const columns = [
//     { header: 'Profile ID', key: 'profileId', width: 15 },
//     { header: 'Full Name', key: 'fullName', width: 20 },
//     { header: 'Email', key: 'email', width: 25 },
//     { header: 'Phone', key: 'phone', width: 15 },
//     { header: 'Profile For', key: 'profile_for', width: 15 },
//     { header: 'Source', key: 'source', width: 10 },
//     { header: 'Active', key: 'active', width: 10 },
//     { header: 'Date of Birth', key: 'dob', width: 15 },
//     { header: 'Gender', key: 'gender', width: 10 },
//     { header: 'Like Count', key: 'likeCount', width: 12 },
//     { header: 'Marital Status', key: 'marital_status', width: 15 },
//     { header: 'Height', key: 'height', width: 10 },
//     { header: 'Country', key: 'country', width: 15 },
//     { header: 'State', key: 'state', width: 15 },
//     { header: 'State Code', key: 'stateCode', width: 12 },
//     { header: 'City', key: 'city', width: 15 },
//     { header: 'Annual Income', key: 'annual_income', width: 15 },
//     { header: 'Employed In', key: 'employed_in', width: 15 },
//     { header: 'Highest Education', key: 'highest_education', width: 20 },
//     { header: 'Course', key: 'course', width: 20 },
//     { header: 'Occupation', key: 'occupation', width: 20 },
//     { header: 'Mother Tongue', key: 'mother_tongue', width: 15 },
//     { header: 'Religion', key: 'religion', width: 15 },
//     { header: 'Sect', key: 'sect', width: 15 },
//     { header: 'Jammat', key: 'jammat', width: 15 },
//     { header: 'Caste', key: 'caste', width: 15 },
//     { header: 'Thoughts on Horoscope', key: 'thoughts_on_horoscope', width: 20 },
//     { header: 'Manglik', key: 'manglik', width: 10 },
//     { header: 'Profile Status', key: 'profileStatus', width: 15 },
//     { header: 'Preference Status', key: 'preferenceStatus', width: 18 },
//     { header: 'Living with Family', key: 'living_with_family', width: 18 },
//     { header: 'Diet', key: 'diet', width: 15 },
//     { header: 'Profile Images', key: 'profile_image', width: 30 },
//     { header: 'Created At', key: 'created_at', width: 20 },
//     { header: 'Updated At', key: 'updated_at', width: 20 }
//   ];
  
//   worksheet.columns = columns;
  
//   // Style the header row
//   const headerRow = worksheet.getRow(1);
//   headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
//   headerRow.fill = {
//     type: 'pattern',
//     pattern: 'solid',
//     fgColor: { argb: '4472C4' }
//   };
//   headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  
//   // Process users in batches to avoid memory issues
//   const batchSize = 1000;
//   let currentRow = 2;
  
//   for (let i = 0; i < users.length; i += batchSize) {
//     const batch = users.slice(i, i + batchSize);
    
//     batch.forEach(user => {
//       const row = worksheet.getRow(currentRow);
      
//       // Format data for Excel
//       const rowData = {
//         profileId: user.profileId || '',
//         fullName: user.fullName || '',
//         email: user.email || '',
//         phone: user.phone || '',
//         profile_for: user.profile_for || '',
//         source: user.source || '',
//         active: user.active ? 'Yes' : 'No',
//         dob: user.dob ? new Date(user.dob).toLocaleDateString() : '',
//         gender: user.gender || '',
//         likeCount: user.likeCount || 0,
//         marital_status: user.marital_status || '',
//         height: user.height || '',
//         country: user.country || '',
//         state: user.state || '',
//         stateCode: user.stateCode || '',
//         city: user.city || '',
//         annual_income: user.annual_income || '',
//         employed_in: user.employed_in || '',
//         highest_education: user.highest_education || '',
//         course: user.course || '',
//         occupation: user.occupation || '',
//         mother_tongue: user.mother_tongue || '',
//         religion: user.religion || '',
//         sect: user.sect || '',
//         jammat: user.jammat || '',
//         caste: user.caste || '',
//         thoughts_on_horoscope: user.thoughts_on_horoscope || '',
//         manglik: user.manglik || '',
//         profileStatus: user.profileStatus || '',
//         preferenceStatus: user.preferenceStatus || '',
//         living_with_family: user.living_with_family || '',
//         diet: user.diet || '',
//         profile_image: Array.isArray(user.profile_image) ? user.profile_image.join(', ') : (user.profile_image || ''),
//         created_at: user.created_at ? new Date(user.created_at).toLocaleString() : '',
//         updated_at: user.updated_at ? new Date(user.updated_at).toLocaleString() : ''
//       };
      
//       row.values = Object.values(rowData);
//       currentRow++;
//     });
//   }
  
//   // Auto-fit columns
//   worksheet.columns.forEach(column => {
//     if (column.width < 10) column.width = 10;
//     if (column.width > 50) column.width = 50;
//   });
  
//   // Generate filename with timestamp and filters
//   const timestamp = new Date().toISOString().split('T')[0];
//   let filename = `users_export_${timestamp}`;
  
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
  
//   // Write workbook to response
//   await workbook.xlsx.write(res);
//   res.end();
// });

const exportUsers = asyncHandler(async (req, res, next) => {
  const { 
    dateFrom, 
    dateTo, 
    sortBy = 'newest', 
    limit = 10000,
    column // Frontend sends selected fields as 'columns'
  } = req.query;

  console.log('column', column, 're.query',req.query)
  
  // Validate limit to prevent server overload
  const maxLimit = Math.min(parseInt(limit) || 10000, 50000);
  
  // Define all available fields that can be exported
  const availableFields = {
    profileId: { header: 'Profile ID', width: 15 },
    fullName: { header: 'Full Name', width: 20 },
    email: { header: 'Email', width: 25 },
    phone: { header: 'Phone', width: 15 },
    profile_for: { header: 'Profile For', width: 15 },
    source: { header: 'Source', width: 10 },
    active: { header: 'Active', width: 10 },
    dob: { header: 'Date of Birth', width: 15 },
    gender: { header: 'Gender', width: 10 },
    likeCount: { header: 'Like Count', width: 12 },
    marital_status: { header: 'Marital Status', width: 15 },
    height: { header: 'Height', width: 10 },
    country: { header: 'Country', width: 15 },
    state: { header: 'State', width: 15 },
    stateCode: { header: 'State Code', width: 12 },
    city: { header: 'City', width: 15 },
    annual_income: { header: 'Annual Income', width: 15 },
    employed_in: { header: 'Employed In', width: 15 },
    highest_education: { header: 'Highest Education', width: 20 },
    course: { header: 'Course', width: 20 },
    occupation: { header: 'Occupation', width: 20 },
    mother_tongue: { header: 'Mother Tongue', width: 15 },
    religion: { header: 'Religion', width: 15 },
    sect: { header: 'Sect', width: 15 },
    jammat: { header: 'Jammat', width: 15 },
    caste: { header: 'Caste', width: 15 },
    thoughts_on_horoscope: { header: 'Thoughts on Horoscope', width: 20 },
    manglik: { header: 'Manglik', width: 10 },
    profileStatus: { header: 'Profile Status', width: 15 },
    preferenceStatus: { header: 'Preference Status', width: 18 },
    living_with_family: { header: 'Living with Family', width: 18 },
    diet: { header: 'Diet', width: 15 },
    profile_image: { header: 'Profile Images', width: 30 },
    created_at: { header: 'Created At', width: 20 },
    updated_at: { header: 'Updated At', width: 20 }
  };

  // Parse selected fields from query parameter
  let selectedFields;
  if (column) {
    try {
      // Columns can be sent as comma-separated string or JSON array
      if (typeof column === 'string') {
        selectedFields = column.split(',').map(field => field.trim());
      } else if (Array.isArray(column)) {
        selectedFields = column;
      } else {
        selectedFields = Object.keys(availableFields); // Default to all fields
      }
    } catch (error) {
      return next(new ApiError('Invalid columns parameter format', 400));
    }
  } else {
    // If no columns specified, use all available fields
    selectedFields = Object.keys(availableFields);
  }

  // Validate selected fields
  const invalidFields = selectedFields.filter(field => !availableFields[field]);
  if (invalidFields.length > 0) {
    return next(new ApiError(`Invalid column(s): ${invalidFields.join(', ')}. Available columns: ${Object.keys(availableFields).join(', ')}`, 400));
  }

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
  
  // Fields to always exclude from database query (sensitive/unnecessary data)
  const alwaysExcludeFields = {
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

  // Create projection object - MongoDB doesn't allow mixing inclusion and exclusion
  // So we'll use inclusion projection for selected fields and exclude sensitive fields in code
  const projection = {};
  selectedFields.forEach(field => {
    projection[field] = 1;
  });
  
  // Stream processing for large datasets
  let users = await User.find(filter, projection)
    .sort({ created_at: sortOrder })
    .limit(maxLimit)
    .lean() // Use lean() for better performance
    .exec();

  // Filter out any sensitive fields that might have been included
  const sensitiveFields = ['min_salary', 'max_salary', 'heightInCm', 'description', 'deviceId', 'deviceToken', 'birthplace', 'birth_long', 'birth_lat', 'birth_time', 'location', 'otp', 'otp_expiry', '__v'];
  
  users = users.map(user => {
    const filteredUser = {};
    selectedFields.forEach(field => {
      if (!sensitiveFields.includes(field)) {
        filteredUser[field] = user[field];
      }
    });
    return filteredUser;
  });

  if (!users || users.length === 0) {
    return next(new ApiError('No users found for the specified criteria', 404));
  }
  
  // Create Excel workbook
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Users Export');
  
  // Define columns based on selected fields
  const columns = selectedFields.map(fieldKey => ({
    header: availableFields[fieldKey].header,
    key: fieldKey,
    width: availableFields[fieldKey].width
  }));
  
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
      
      // Format data for Excel - only include selected fields
      const rowData = {};
      selectedFields.forEach(field => {
        switch (field) {
          case 'active':
            rowData[field] = user.active ? 'Yes' : 'No';
            break;
          case 'dob':
            rowData[field] = user.dob ? new Date(user.dob).toLocaleDateString() : '';
            break;
          case 'likeCount':
            rowData[field] = user.likeCount || 0;
            break;
          case 'profile_image':
            rowData[field] = Array.isArray(user.profile_image) ? user.profile_image.join(', ') : (user.profile_image || '');
            break;
          case 'created_at':
            rowData[field] = user.created_at ? new Date(user.created_at).toLocaleString() : '';
            break;
          case 'updated_at':
            rowData[field] = user.updated_at ? new Date(user.updated_at).toLocaleString() : '';
            break;
          default:
            rowData[field] = user[field] || '';
        }
      });
      
      // Set row values in the same order as selected fields
      row.values = selectedFields.map(field => rowData[field]);
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
  
  filename += `_${sortBy}_${selectedFields.length}columns.xlsx`;
  
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

// Optional: Add a helper endpoint to get available columns
const getAvailableColumns = asyncHandler(async (req, res, next) => {
  const availableColumns = [
    'profileId', 'fullName', 'email', 'phone', 'profile_for', 'source', 'active',
    'dob', 'gender', 'likeCount', 'marital_status', 'height', 'country', 'state',
    'stateCode', 'city', 'annual_income', 'employed_in', 'highest_education',
    'course', 'occupation', 'mother_tongue', 'religion', 'sect', 'jammat',
    'caste', 'thoughts_on_horoscope', 'manglik', 'profileStatus', 
    'preferenceStatus', 'living_with_family', 'diet', 'profile_image',
    'created_at', 'updated_at'
  ];

  res.status(200).json({
    success: true,
    message: 'Available columns for export',
    data: {
      availableColumns,
      totalColumns: availableColumns.length
    }
  });
});


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

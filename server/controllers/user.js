import User from '../models/user.js'
import Lead from '../models/lead.js'
import { createError, isValidDate } from '../utils/error.js'
import bcrypt from 'bcryptjs'
import validator from 'validator'

const isValidPhone = (phone) => validator.isMobilePhone(phone, 'any')


export const getUsers = async (req, res, next) => {
    try {

        const users = await User.find()
        res.status(200).json({ result: users, message: 'users fetched seccessfully', success: true })

    } catch (err) {
        next(createError(500, err.message))

    }
}

export const getUser = async (req, res, next) => {
    try {

        const { userId } = req.params
        const findedUser = await User.findById(userId)
        if (!findedUser) return next(createError(401, 'User not exist'))

        res.status(200).json({ result: findedUser, message: 'user fetched seccessfully', success: true })

    } catch (err) {
        next(createError(500, err.message))

    }
}

export const filterUser = async (req, res, next) => {
    const { startingDate, endingDate, ...filters } = req.query;
    try {
        let query = await User.find(filters)

        // Check if startingDate is provided and valid
        if (startingDate && isValidDate(startingDate)) {
            const startDate = new Date(startingDate);
            startDate.setHours(0, 0, 0, 0);

            // Add createdAt filtering for startingDate
            query = query.where('createdAt').gte(startDate);
        }

        // Check if endingDate is provided and valid
        if (endingDate && isValidDate(endingDate)) {
            const endDate = new Date(endingDate);
            endDate.setHours(23, 59, 59, 999);

            // Add createdAt filtering for endingDate
            if (query.model.modelName === 'User') { // Check if the query has not been executed yet
                query = query.where('createdAt').lte(endDate);
            }
        }
        if (query.length > 0) {
            query = await query.populate('userId').exec();
        }
        res.status(200).json({ result: query });

    } catch (error) {
        next(createError(500, error.message));
    }
};


export const getClients = async (req, res, next) => {
    try {

        const findedClients = await User.find({ role: 'client' }).sort({ createdAt: -1 })
        res.status(200).json({ result: findedClients, message: 'clients fetched seccessfully', success: true })

    } catch (err) {
        next(createError(500, err.message))

    }
}

export const getEmployeeClients = async (req, res, next) => {
    try {
        let allClients = await User.find({ role: 'client' })
        const employeeLeads = await Lead.find({ allocatedTo: { $in: req.user?._id }, isArchived: false })

        // Filter clients based on the condition
        allClients = allClients.filter((client) => {
            return employeeLeads.findIndex(lead => lead.clientPhone.toString() === client.phone.toString()) !== -1
        }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.status(200).json({ result: allClients, message: 'clients fetched successfully', success: true });
    } catch (err) {
        next(createError(500, err.message));
    }
};

export const getEmployees = async (req, res, next) => {
    try {

        const findedEmployees = await User.find({ role: 'employee' }).sort({ createdAt: -1 })
        res.status(200).json({ result: findedEmployees, message: 'employees fetched seccessfully', success: true })

    } catch (err) {
        next(createError(500, err.message))
    }
}

export const createClient = async (req, res, next) => {
    try {

        const { firstName, lastName, username, phone, email, city, CNIC } = req.body

        if (!firstName || !lastName || !username || !phone) return next(createError(400, 'firstName, lastName, username and phone are required'))
        if (username.length < 3) return next(createError(400, 'Username should be at least 3 characters'))
        if (email && !validator.isEmail(email)) return next(createError(400, 'Invalid email address'))
        if (!isValidPhone(phone)) return next(createError(400, 'Invalid phone number'))
        if (CNIC && (typeof CNIC !== 'string' || CNIC.trim().length === 0)) return next(createError(400, 'Invalid CNIC'))

        const findedByUsername = await User.findOne({ username })
        if (Boolean(findedByUsername)) return next(createError(400, 'Username already exist'))

        if (email) {
            const findedUser = await User.findOne({ email })
            if (Boolean(findedUser)) return next(createError(400, 'Email already exist'))
        }

        const findedByPhone = await User.findOne({ phone })
        if (Boolean(findedByPhone)) return next(createError(400, 'Phone number already exist'))

        const result = await User.create({ firstName, lastName, username, phone, email, city, CNIC, role: 'client' })
        res.status(200).json({ result, message: 'client created successfully', success: true })

    } catch (err) {
        next(createError(500, err.message))
    }
}
export const createEmployee = async (req, res, next) => {
    try {

        const { firstName, lastName, username, phone, email, password, city, CNIC } = req.body

        if (!firstName || !lastName || !username || !phone || !password) return next(createError(400, 'firstName, lastName, username, phone and password are required'))
        if (username.length < 3) return next(createError(400, 'Username should be at least 3 characters'))
        if (email && !validator.isEmail(email)) return next(createError(400, 'Invalid email address'))
        if (!isValidPhone(phone)) return next(createError(400, 'Invalid phone number'))
        if (password.length < 6) return next(createError(400, 'Password must be at least 6 characters'))
        if (CNIC && (typeof CNIC !== 'string' || CNIC.trim().length === 0)) return next(createError(400, 'Invalid CNIC'))

        const findedUser = await User.findOne({ username })
        if (Boolean(findedUser)) return next(createError(400, 'Username already exist'))

        const findedByPhone = await User.findOne({ phone })
        if (Boolean(findedByPhone)) return next(createError(400, 'Phone number already exist'))

        if (email) {
            const findedByEmail = await User.findOne({ email })
            if (Boolean(findedByEmail)) return next(createError(400, 'Email already exist'))
        }

        const hashedPassword = await bcrypt.hash(password, 12)

        const result = await User.create({ firstName, lastName, username, phone, email, password: hashedPassword, city, CNIC, role: 'employee' })
        res.status(200).json({ result, message: 'employee created successfully', success: true })

    } catch (err) {
        next(createError(500, err.message))
    }
}

export const updateUser = async (req, res, next) => {
    try {

        const { userId } = req.params
        const { firstName, lastName, username, phone, email, city, CNIC } = req.body

        if (!firstName && !lastName && !username && !phone && !email && !city && !CNIC) {
            return next(createError(400, 'At least one field is required to update'))
        }

        const findedUser = await User.findById(userId)
        if (!findedUser) return next(createError(404, 'User not found'))

        if (email && !validator.isEmail(email)) return next(createError(400, 'Invalid email address'))
        if (phone && !isValidPhone(phone)) return next(createError(400, 'Invalid phone number'))
        if (CNIC && (typeof CNIC !== 'string' || CNIC.trim().length === 0)) return next(createError(400, 'Invalid CNIC'))

        if (username && username !== findedUser.username) {
            const usernameTaken = await User.findOne({ username })
            if (usernameTaken) return next(createError(400, 'Username already exist'))
        }

        if (email && email !== findedUser.email) {
            const emailTaken = await User.findOne({ email })
            if (emailTaken) return next(createError(400, 'Email already exist'))
        }

        if (phone && phone !== findedUser.phone) {
            const phoneTaken = await User.findOne({ phone })
            if (phoneTaken) return next(createError(400, 'Phone number already exist'))
        }

        const updateData = {}
        if (firstName) updateData.firstName = firstName
        if (lastName) updateData.lastName = lastName
        if (username) updateData.username = username
        if (phone) updateData.phone = phone
        if (email) updateData.email = email
        if (city) updateData.city = city
        if (CNIC) updateData.CNIC = CNIC

        const updatedUser = await User.findByIdAndUpdate(userId, updateData, { new: true })
        res.status(200).json({ result: updatedUser, message: 'User updated successfully', success: true })

    } catch (err) {
        next(createError(500, err.message))
    }
}

export const updateRole = async (req, res, next) => {
    try {

        const { userId } = req.params
        const { role } = req.body

        const findedUser = await User.findById(userId)
        if (!findedUser) return next(createError(401, 'User not exist'))

        const updatedUser = await User.findByIdAndUpdate(userId, { role }, { new: true })
        res.status(200).json({ reuslt: updatedUser, message: 'Role updated successfully', success: true })

    } catch (err) {
        next(createError(500, err.message))
    }
}

export const deleteUser = async (req, res, next) => {
    try {
        const { userId } = req.params
        const findedUser = await User.findById(userId)
        if (!findedUser) return next(createError(400, 'User not exist'))

        const deletedUser = await User.findByIdAndDelete(userId)
        res.status(200).json({ result: deletedUser, message: 'User deleted successfully', success: true })

    } catch (err) {
        next(createError(500, err.message))
    }
}

export const deleteWholeCollection = async (req, res, next) => {
    try {

        const result = await User.deleteMany()
        res.status(200).json({ result, message: 'User collection deleted successfully', success: true })

    } catch (err) {
        next(createError(500, err.message))
    }
}

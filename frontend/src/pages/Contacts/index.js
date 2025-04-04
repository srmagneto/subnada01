import React, {
    useState,
    useEffect,
    useReducer,
    useContext,
    useRef,
} from "react";
import { socketConnection } from "../../services/socket";
import { toast } from "react-toastify";
import { useHistory } from "react-router-dom";

import { makeStyles } from "@material-ui/core/styles";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import Paper from "@material-ui/core/Paper";
import Button from "@material-ui/core/Button";
import Avatar from "@material-ui/core/Avatar";
import { Facebook, Instagram, WhatsApp } from "@material-ui/icons";
import SearchIcon from "@material-ui/icons/Search";

import TextField from "@material-ui/core/TextField";
import InputAdornment from "@material-ui/core/InputAdornment";

import IconButton from "@material-ui/core/IconButton";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EditIcon from "@material-ui/icons/Edit";
import CheckCircleIcon from "@material-ui/icons/CheckCircle";
import CancelIcon from "@material-ui/icons/Cancel";
import BlockIcon from "@material-ui/icons/Block";

import api from "../../services/api";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import ContactModal from "../../components/ContactModal";
import ConfirmationModal from "../../components/ConfirmationModal/";

import { i18n } from "../../translate/i18n";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import MainContainer from "../../components/MainContainer";
import toastError from "../../errors/toastError";

import { AuthContext } from "../../context/Auth/AuthContext";
import { Can } from "../../components/Can";
import NewTicketModal from "../../components/NewTicketModal";
import { TagsFilter } from "../../components/TagsFilter";
import PopupState, { bindTrigger, bindMenu } from "material-ui-popup-state";
import formatSerializedId from '../../utils/formatSerializedId';

import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';

import {
    ArrowDropDown,
    Backup,
    ContactPhone,
} from "@material-ui/icons";
import { Menu, MenuItem } from "@material-ui/core";

import ContactImportWpModal from "../../components/ContactImportWpModal";
import useCompanySettings from "../../hooks/useSettings/companySettings";

const reducer = (state, action) => {
    if (action.type === "LOAD_CONTACTS") {
        const contacts = action.payload;
        const newContacts = [];

        contacts.forEach((contact) => {
            const contactIndex = state.findIndex((c) => c.id === contact.id);
            if (contactIndex !== -1) {
                state[contactIndex] = contact;
            } else {
                newContacts.push(contact);
            }
        });

        return [...state, ...newContacts];
    }

    if (action.type === "UPDATE_CONTACTS") {
        const contact = action.payload;
        const contactIndex = state.findIndex((c) => c.id === contact.id);

        if (contactIndex !== -1) {
            state[contactIndex] = contact;
            return [...state];
        } else {
            return [contact, ...state];
        }
    }

    if (action.type === "DELETE_CONTACT") {
        const contactId = action.payload;

        const contactIndex = state.findIndex((c) => c.id === contactId);
        if (contactIndex !== -1) {
            state.splice(contactIndex, 1);
        }
        return [...state];
    }

    if (action.type === "RESET") {
        return [];
    }
};

const useStyles = makeStyles((theme) => ({
    mainPaper: {
        flex: 1,
        padding: theme.spacing(1),
        overflowY: "scroll",
        ...theme.scrollbarStyles,
    },
}));

const Contacts = () => {
    const classes = useStyles();
    const history = useHistory();

    const { user } = useContext(AuthContext);

    const [loading, setLoading] = useState(false);
    const [pageNumber, setPageNumber] = useState(1);
    const [searchParam, setSearchParam] = useState("");
    const [contacts, dispatch] = useReducer(reducer, []);
    const [selectedContactId, setSelectedContactId] = useState(null);
    const [contactModalOpen, setContactModalOpen] = useState(false);

    const [importContactModalOpen, setImportContactModalOpen] = useState(false);
    const [deletingContact, setDeletingContact] = useState(null);
    const [ImportContacts, setImportContacts] = useState(null);
    const [blockingContact, setBlockingContact] = useState(null);
    const [unBlockingContact, setUnBlockingContact] = useState(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [exportContact, setExportContact] = useState(false);
    const [confirmChatsOpen, setConfirmChatsOpen] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [newTicketModalOpen, setNewTicketModalOpen] = useState(false);
    const [contactTicket, setContactTicket] = useState({});
    const fileUploadRef = useRef(null);
    const [selectedTags, setSelectedTags] = useState([]);


    const { get: getSetting } = useCompanySettings();
    const [hideNum, setHideNum] = useState(false);

    useEffect(() => {

        async function fetchData() {
            const setting = await getSetting({
                "column": "lgpdHideNumber"
            });

            if (setting.lgpdHideNumber === "enabled") {
                setHideNum(true);
            }
        }
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const handleImportExcel = async () => {
        try {
            const formData = new FormData();
            formData.append("file", fileUploadRef.current.files[0]);
            await api.request({
                url: `/contacts/upload`,
                method: "POST",
                data: formData,
            });
            history.go(0);
        } catch (err) {
            toastError(err);
        }
    };

    useEffect(() => {
        dispatch({ type: "RESET" });
        setPageNumber(1);
    }, [searchParam, selectedTags]);

    useEffect(() => {
        setLoading(true);
        const delayDebounceFn = setTimeout(() => {
            const fetchContacts = async () => {
                try {
                    const { data } = await api.get("/contacts/", {
                        params: { searchParam, pageNumber, contactTag: JSON.stringify(selectedTags) },
                    });
                    dispatch({ type: "LOAD_CONTACTS", payload: data.contacts });
                    setHasMore(data.hasMore);
                    setLoading(false);
                } catch (err) {
                    toastError(err);
                }
            };
            fetchContacts();
        }, 500);
        return () => clearTimeout(delayDebounceFn);
    }, [searchParam, pageNumber, selectedTags]);

    useEffect(() => {
        const companyId = user.companyId;
        const socket = socketConnection({ companyId, userId: user.id });

        socket.on(`company-${companyId}-contact`, (data) => {
            if (data.action === "update" || data.action === "create") {
                dispatch({ type: "UPDATE_CONTACTS", payload: data.contact });
            }

            if (data.action === "delete") {
                dispatch({ type: "DELETE_CONTACT", payload: +data.contactId });
            }
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    const handleCloseOrOpenTicket = (ticket) => {
        setNewTicketModalOpen(false);
        if (ticket !== undefined && ticket.uuid !== undefined) {
            history.push(`/tickets/${ticket.uuid}`);
        }
    };

    const handleSelectedTags = (selecteds) => {
        const tags = selecteds.map((t) => t.id);
        setSelectedTags(tags);
    };

    const handleSearch = (event) => {
        setSearchParam(event.target.value.toLowerCase());
    };

    const handleOpenContactModal = () => {
        setSelectedContactId(null);
        setContactModalOpen(true);
    };

    const handleCloseContactModal = () => {
        setSelectedContactId(null);
        setContactModalOpen(false);
    };

    const hadleEditContact = (contactId) => {
        setSelectedContactId(contactId);
        setContactModalOpen(true);
    };

    const handleDeleteContact = async (contactId) => {
        try {
            await api.delete(`/contacts/${contactId}`);
            toast.success(i18n.t("contacts.toasts.deleted"));
        } catch (err) {
            toastError(err);
        }
        setDeletingContact(null);
        setSearchParam("");
        setPageNumber(1);
    };

    const handleBlockContact = async (contactId) => {
        try {
            await api.put(`/contacts/block/${contactId}`, { active: false });
            toast.success("Contato bloqueado");
        } catch (err) {
            toastError(err);
        }
        setDeletingContact(null);
        setSearchParam("");
        setPageNumber(1);
        setBlockingContact(null);
    };

    const handleUnBlockContact = async (contactId) => {
        try {
            await api.put(`/contacts/block/${contactId}`, { active: true });
            toast.success("Contato desbloqueado");
        } catch (err) {
            toastError(err);
        }
        setDeletingContact(null);
        setSearchParam("");
        setPageNumber(1);
        setUnBlockingContact(null);
    };

    const handleimportContact = async () => {
        try {
            await api.post("/contacts/import");
            history.go(0);
            setImportContacts(false);
        } catch (err) {
            toastError(err);
            setImportContacts(false);
        }
    };

    const handleimportChats = async () => {
        try {
            await api.post("/contacts/import/chats");
            history.go(0);
        } catch (err) {
            toastError(err);
        }
    };

    const loadMore = () => {
        setPageNumber((prevState) => prevState + 1);
    };

    const handleScroll = (e) => {
        if (!hasMore || loading) return;
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        if (scrollHeight - (scrollTop + 100) < clientHeight) {
            loadMore();
        }
    };

    function getDateLastMessage(contact) {
        if (!contact) return null;
        if (!contact.tickets) return null;

        if (contact.tickets.length > 0) {
            const date = new Date(
                contact.tickets[contact.tickets.length - 1].updatedAt
            );

            const day =
                date.getDate() > 9 ? date.getDate() : `0${date.getDate()}`;
            const month = date.getMonth() + 1;
            const year = date.getFullYear();

            const hours = date.getHours();
            const minutes = date.getMinutes();

            return `${day}/${month}/${year} ${hours}:${minutes}`;
        }

        return null;
    }

    return (

        <MainContainer className={classes.mainContainer}>
            <NewTicketModal
                modalOpen={newTicketModalOpen}
                initialContact={contactTicket}
                onClose={(ticket) => {
                    handleCloseOrOpenTicket(ticket);
                }}
            />
            <ContactModal
                open={contactModalOpen}
                onClose={handleCloseContactModal}
                aria-labelledby="form-dialog-title"
                contactId={selectedContactId}
            ></ContactModal>
            <ConfirmationModal
                title={
                    deletingContact
                        ? `${i18n.t(
                            "contacts.confirmationModal.deleteTitle"
                        )} ${deletingContact.name}?`
                        : blockingContact
                            ? `Bloquear Contato ${blockingContact.name}?`
                            : unBlockingContact
                                ? `Desbloquear Contato ${unBlockingContact.name}?`
                                : ImportContacts
                                    ? `${i18n.t("contacts.confirmationModal.importTitlte")}`
                                    : `${i18n.t("contactListItems.confirmationModal.importTitlte")}`
                }
                open={confirmOpen}
                onClose={setConfirmOpen}
                onConfirm={(e) =>
                    deletingContact
                        ? handleDeleteContact(deletingContact.id)
                        : blockingContact
                            ? handleBlockContact(blockingContact.id)
                            : unBlockingContact
                                ? handleUnBlockContact(unBlockingContact.id)
                                : ImportContacts
                                    ? handleimportContact()
                                    : handleImportExcel()
                }
            >
                {exportContact
                    ?
                    `${i18n.t("contacts.confirmationModal.exportContact")}`
                    : deletingContact
                        ? `${i18n.t("contacts.confirmationModal.deleteMessage")}`
                        : blockingContact
                            ? `${i18n.t("contacts.confirmationModal.blockContact")}`
                            : unBlockingContact
                                ? `${i18n.t("contacts.confirmationModal.unblockContact")}`
                                : ImportContacts
                                    ? `${i18n.t("contacts.confirmationModal.importMessage")}`
                                    : `${i18n.t(
                                        "contactListItems.confirmationModal.importMessage"
                                    )}`}
            </ConfirmationModal>
            <ConfirmationModal
                title={i18n.t("contacts.confirmationModal.importChat")}
                open={confirmChatsOpen}
                onClose={setConfirmChatsOpen}
                onConfirm={(e) => handleimportChats()}
            >
                {i18n.t("contacts.confirmationModal.wantImport")}
            </ConfirmationModal>
            <MainHeader>
                <Title>{i18n.t("contacts.title")} ({contacts.length})</Title>
                <MainHeaderButtonsWrapper>
                    <TagsFilter
                        onFiltered={handleSelectedTags}
                    />
                    <TextField
                        placeholder={i18n.t("contacts.searchPlaceholder")}
                        type="search"
                        value={searchParam}
                        onChange={handleSearch}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon color="secondary" />
                                </InputAdornment>
                            ),
                        }}
                    />
                    <PopupState variant="popover" popupId="demo-popup-menu">
                        {(popupState) => (
                            <React.Fragment>
                                <Button
                                    variant="contained"
                                    color="primary"
                                    {...bindTrigger(popupState)}
                                >
                                    Importar / Exportar
                                    <ArrowDropDown />
                                </Button>
                                <Menu {...bindMenu(popupState)}>
                                    <MenuItem
                                        onClick={() => {
                                            setConfirmOpen(true);
                                            setImportContacts(true);
                                            popupState.close();
                                        }}
                                    >
                                        <ContactPhone
                                            fontSize="small"
                                            color="primary"
                                            style={{
                                                marginRight: 10,
                                            }}
                                        />
                                        {i18n.t("contacts.menu.importYourPhone")}
                                    </MenuItem>
                                    <MenuItem
                                        onClick={() => { setImportContactModalOpen(true) }}

                                    >
                                        <Backup
                                            fontSize="small"
                                            color="primary"
                                            style={{
                                                marginRight: 10,
                                            }}
                                        />
                                        {i18n.t("contacts.menu.importToExcel")}

                                    </MenuItem>
                                    {/* {<MenuItem>
                        
                                       <CSVLink
                                            className={classes.csvbtn}
                                            separator=";"
                                            filename={'contacts.csv'}
                                            data={
                                                contacts.map((contact) => ({
                                                    number: hideNum && user.profile === "user" ? contact.isGroup ? contact.number : formatSerializedId(contact.number).slice(0,-6)+"**-**"+ contact.number.slice(-2): contact.isGroup ? contact.number : formatSerializedId(contact.number),
                                                    firstName: contact.name.split(' ')[0],
                                                    lastname: String(contact.name).replace(contact.name.split(' ')[0],''),
                                                    tags: contact?.tags?.name
                                                }))

                                            }
                                            
                                            >
                                        
                                        <CloudDownload fontSize="small"
                                            color="primary"
                                            style={{
                                                marginRight: 10,
                                            
                                                }}                                                
                                        />        
                                        Exportar Excel                                
                                   </CSVLink>
                                        
                                    </MenuItem> } */}
                                </Menu>
                            </React.Fragment>
                        )}
                    </PopupState>
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={handleOpenContactModal}
                    >
                        {i18n.t("contacts.buttons.add")}
                    </Button>
                </MainHeaderButtonsWrapper>
            </MainHeader>

            <ContactImportWpModal
                isOpen={importContactModalOpen}
                handleClose={() => setImportContactModalOpen(false)}
                selectedTags={selectedTags}
                hideNum={hideNum}
                userProfile={user.profile}
            />
            <Paper
                className={classes.mainPaper}
                variant="outlined"
                onScroll={handleScroll}
            >
                <>
                    <input
                        style={{ display: "none" }}
                        id="upload"
                        name="file"
                        type="file"
                        accept=".xls,.xlsx"
                        onChange={() => {
                            setConfirmOpen(true);
                        }}
                        ref={fileUploadRef}
                    />
                </>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell padding="checkbox" />
                            <TableCell>
                                {i18n.t("contacts.table.name")}
                            </TableCell>
                            <TableCell align="center">
                                {i18n.t("contacts.table.whatsapp")}
                            </TableCell>
                            <TableCell align="center">
                                {i18n.t("contacts.table.email")}
                            </TableCell>
                            <TableCell align="center">
                                {i18n.t("contacts.table.lastMessage")}
                            </TableCell>
                            <TableCell align="center">{"Status"}</TableCell>
                            <TableCell align="center">
                                {i18n.t("contacts.table.actions")}
                            </TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        <>
                            {contacts.map((contact) => (
                                <TableRow key={contact.id}>
                                    <TableCell style={{ paddingRight: 0 }}>
                                        {<Avatar src={`${contact?.urlPicture}`} />}
                                    </TableCell>
                                    <TableCell>{contact.name}</TableCell>
                                    <TableCell
                                        align="right"
                                        style={{
                                            display: 'absolute',
                                            justifyContent: 'absolute',
                                            alignItems: 'absolute',
                                            height: '100%',
                                            padding: '-1%',
                                        }}
                                    >
                                        <div style={{ position: 'flex', width: '150%', display: 'absolute', alignItems: 'center' }}>
                                            <PhoneInput
                                                value={contact.number} // Número do contato
                                                country={contact.number.startsWith('+') ? contact.number.slice(1, 3) : 'br'} // Código do país
                                                disableCountryCode={false} // Permite editar o código do país
                                                onlyCountries={[
                                                    'af', 'al', 'dz', 'as', 'ad', 'ao', 'ai', 'aq', 'ag', 'ar', 'am', 'aw', 'au',
                                                    'at', 'az', 'bs', 'bh', 'bd', 'bb', 'by', 'be', 'bz', 'bj', 'bm', 'bt', 'bo',
                                                    'ba', 'bw', 'br', 'bn', 'bg', 'bf', 'bi', 'kh', 'cm', 'ca', 'cv', 'cf', 'td',
                                                    'cl', 'cn', 'co', 'km', 'cg', 'cd', 'cr', 'hr', 'cu', 'cy', 'cz', 'dk', 'dj',
                                                    'dm', 'do', 'ec', 'eg', 'sv', 'gq', 'er', 'ee', 'et', 'fk', 'fo', 'fj', 'fi',
                                                    'fr', 'gf', 'pf', 'ga', 'gm', 'ge', 'de', 'gh', 'gi', 'gr', 'gl', 'gd', 'gp',
                                                    'gu', 'gt', 'gn', 'gw', 'gy', 'ht', 'hn', 'hk', 'hu', 'is', 'in', 'id', 'ir',
                                                    'iq', 'ie', 'il', 'it', 'jm', 'jp', 'jo', 'kz', 'ke', 'ki', 'kp', 'kr', 'kw',
                                                    'kg', 'la', 'lv', 'lb', 'ls', 'lr', 'ly', 'li', 'lt', 'lu', 'mo', 'mk', 'mg',
                                                    'mw', 'my', 'mv', 'ml', 'mt', 'mh', 'mq', 'mr', 'mu', 'yt', 'mx', 'fm', 'md',
                                                    'mc', 'mn', 'me', 'ma', 'mz', 'mm', 'na', 'nr', 'np', 'nl', 'nc', 'nz', 'ni',
                                                    'ne', 'ng', 'nu', 'nf', 'mp', 'no', 'om', 'pk', 'pw', 'ps', 'pa', 'pg', 'py',
                                                    'pe', 'ph', 'pl', 'pt', 'pr', 'qa', 're', 'ro', 'ru', 'rw', 'sh', 'kn', 'lc',
                                                    'pm', 'vc', 'ws', 'sm', 'st', 'sa', 'sn', 'rs', 'sc', 'sl', 'sg', 'sk', 'si',
                                                    'sb', 'so', 'za', 'es', 'lk', 'sd', 'sr', 'sz', 'se', 'ch', 'sy', 'tw', 'tj',
                                                    'tz', 'th', 'tl', 'tg', 'to', 'tt', 'tn', 'tr', 'tm', 'tc', 'tv', 'ug', 'ua',
                                                    'ae', 'gb', 'us', 'uy', 'uz', 'vu', 'va', 've', 'vn', 'wf', 'ye', 'zm', 'zw'
                                                ]} // Lista de países permitidos
                                                disableDropdown={true} // Impede que o usuário altere a bandeira
                                                inputStyle={{
                                                    width: 'calc(100% - 30px)', // Reserva espaço para a bandeira
                                                    textAlign: 'absolute', // Alinha o número à direita
                                                    border: 'none',
                                                    background: 'transparent',
                                                    paddingLeft: '10px', // Espaço para bandeira
                                                    paddingRight: '-100px', // Ajuste do espaçamento à direita
                                                    fontSize: '14px',
                                                }}
                                                buttonStyle={{
                                                    position: 'absolute',
                                                    left: '0',
                                                    top: '50%',
                                                    transform: 'translateY(-50%)', // Centraliza verticalmente
                                                    border: 'none',
                                                    background: 'transparent',
                                                    padding: '0',
                                                }}
                                                isValid={(value) => value && value.length > 0}
                                                placeholder="Número não disponível"
                                            />
                                        </div>
                                    </TableCell>



                                    <TableCell align="center">
                                        {contact.email}
                                    </TableCell>
                                    <TableCell align="center">
                                        {getDateLastMessage(contact)}
                                    </TableCell>
                                    <TableCell align="center">
                                        {contact.active ? (
                                            <CheckCircleIcon
                                                style={{ color: "green" }}
                                                fontSize="small"
                                            />
                                        ) : (
                                            <CancelIcon
                                                style={{ color: "red" }}
                                                fontSize="small"
                                            />
                                        )}
                                    </TableCell>
                                    <TableCell align="center">
                                        <IconButton
                                            size="small"
                                            onClick={() => {
                                                setContactTicket(contact);
                                                setNewTicketModalOpen(true);
                                                // handleSaveTicket(contact.id);
                                            }}
                                        >
                                            {contact.channel === "whatsapp" && (<WhatsApp style={{ color: "green" }} />)}
                                            {contact.channel === "instagram" && (<Instagram style={{ color: "purple" }} />)}
                                            {contact.channel === "facebook" && (<Facebook style={{ color: "blue" }} />)}
                                        </IconButton>

                                        <IconButton
                                            size="small"
                                            onClick={() =>
                                                hadleEditContact(contact.id)
                                            }
                                        >
                                            <EditIcon color="secondary" />
                                        </IconButton>
                                        <IconButton
                                            size="small"
                                            onClick={
                                                contact.active
                                                    ? () => {
                                                        setConfirmOpen(true);
                                                        setBlockingContact(
                                                            contact
                                                        );
                                                    }
                                                    : () => {
                                                        setConfirmOpen(true);
                                                        setUnBlockingContact(
                                                            contact
                                                        );
                                                    }
                                            }
                                        >
                                            {contact.active ? (
                                                <BlockIcon color="secondary" />
                                            ) : (
                                                <CheckCircleIcon color="secondary" />
                                            )}
                                        </IconButton>
                                        <Can
                                            role={user.profile}
                                            perform="contacts-page:deleteContact"
                                            yes={() => (
                                                <IconButton
                                                    size="small"
                                                    onClick={(e) => {
                                                        setConfirmOpen(true);
                                                        setDeletingContact(
                                                            contact
                                                        );
                                                    }}
                                                >
                                                    <DeleteOutlineIcon color="secondary" />
                                                </IconButton>
                                            )}
                                        />
                                    </TableCell>
                                </TableRow>
                            ))}
                            {loading && <TableRowSkeleton avatar columns={3} />}
                        </>
                    </TableBody>
                </Table>
            </Paper>
        </MainContainer >
    );
};

export default Contacts;
